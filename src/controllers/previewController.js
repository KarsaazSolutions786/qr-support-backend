/**
 * Preview Controller
 *
 * Handles QR code preview generation requests.
 * Gets design data from Laravel, converts SVG to PNG using Sharp.
 */

const laravelService = require('../services/laravelService');
const svgToPngService = require('../services/svgToPngService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

/**
 * Generate preview PNG from design data
 *
 * POST /api/qr/preview
 *
 * Body:
 * - type: QR code type (url, text, vcard, etc.)
 * - data: QR code data (url, text content, etc.)
 * - design: Design configuration
 * - size: Output size (default 512)
 * - quality: PNG quality (default 90)
 * - force_png: Always return PNG (default true)
 */
exports.generatePreview = async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            type = 'url',
            data = {},
            design = {},
            size = 512,
            quality = 90,
            force_png = true,
        } = req.body;

        // Validate required fields
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'QR code data is required',
                },
            });
        }

        // Check cache first
        const cacheKey = cacheService.generateKey({
            type,
            data,
            design,
            size,
            quality,
        });

        const cachedPng = await cacheService.get(cacheKey);
        if (cachedPng) {
            const duration = Date.now() - startTime;
            return res.json({
                success: true,
                data: {
                    rendering_strategy: 'server',
                    strategy_reason: 'cached',
                    images: {
                        png_base64: cachedPng.toString('base64'),
                        format: 'png',
                        size: `${size}x${size}`,
                    },
                    meta: {
                        cached: true,
                        generation_ms: duration,
                    },
                },
            });
        }

        const authToken = req.headers['authorization'];
        let pngBase64 = null;
        let qrPayload = null;
        let responseDesign = design;

        // Strategy 1: Try v2 API first (may return PNG directly if Imagick available)
        try {
            const v2Response = await laravelService.getPreview({
                type,
                data,
                design,
                output_format: 'png',
                force_server: true,
            }, authToken);

            // If Laravel returned PNG, use it
            if (v2Response.data?.images?.png_base64) {
                const duration = Date.now() - startTime;
                return res.json({
                    success: true,
                    data: {
                        ...v2Response.data,
                        meta: {
                            ...v2Response.data.meta,
                            node_processed: false,
                            generation_ms: duration,
                        },
                    },
                });
            }

            // Extract qr_payload and design from v2 response
            qrPayload = v2Response.data?.qr_payload;
            if (v2Response.data?.design) {
                responseDesign = v2Response.data.design;
            }
        } catch (v2Error) {
            logger.warn(`V2 preview failed, trying original endpoint: ${v2Error.message}`);
        }

        // Strategy 2: Get SVG from original preview endpoint and convert
        try {
            const svgResponse = await laravelService.getPreviewSvg({
                type,
                data,
                design,
            }, authToken);

            // Extract SVG from Laravel response
            // Response format: { success: true, preview: { svg: "..." }, meta: {...} }
            let svgContent = null;
            if (svgResponse.preview?.svg) {
                svgContent = svgResponse.preview.svg;
            } else if (svgResponse.svg) {
                svgContent = svgResponse.svg;
            } else if (svgResponse.data?.preview?.svg) {
                svgContent = svgResponse.data.preview.svg;
            } else if (svgResponse.data?.svg) {
                svgContent = svgResponse.data.svg;
            }

            logger.debug(`SVG extraction: found=${!!svgContent}, keys=${Object.keys(svgResponse || {}).join(',')}`);
            if (svgResponse.preview) {
                logger.debug(`Preview keys: ${Object.keys(svgResponse.preview).join(',')}`);
            }

            if (svgContent) {
                logger.debug('Converting SVG to PNG using Sharp');
                const pngBuffer = await svgToPngService.convert(svgContent, {
                    size,
                    quality,
                    transparent: design.transparent_background || false,
                });

                pngBase64 = pngBuffer.toString('base64');

                // Cache the result
                await cacheService.set(cacheKey, pngBuffer);
            }

            // Extract qr_payload if not already set
            if (!qrPayload) {
                qrPayload = svgResponse.qr_payload || svgResponse.data?.qr_payload;
            }
        } catch (svgError) {
            logger.warn(`SVG preview failed: ${svgError.message}`);
        }

        const duration = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                rendering_strategy: pngBase64 ? 'server' : 'native',
                strategy_reason: pngBase64 ? 'node_converted' : 'no_svg_available',
                qr_payload: qrPayload,
                design: responseDesign,
                images: pngBase64 ? {
                    png_base64: pngBase64,
                    format: 'png',
                    size: `${size}x${size}`,
                } : null,
                meta: {
                    type,
                    cached: false,
                    node_processed: !!pngBase64,
                    generation_ms: duration,
                },
            },
        });
    } catch (error) {
        logger.error(`Preview generation failed: ${error.message}`);

        // If Laravel returned an error response, forward it
        if (error.status && error.data) {
            return res.status(error.status).json(error.data);
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'PREVIEW_FAILED',
                message: `Failed to generate preview: ${error.message}`,
            },
        });
    }
};
