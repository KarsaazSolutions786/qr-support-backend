/**
 * QR Code Controller
 *
 * Handles QR code image rendering and retrieval.
 * Fetches SVG from Laravel and converts to PNG.
 */

const laravelService = require('../services/laravelService');
const svgToPngService = require('../services/svgToPngService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

/**
 * Render QR code from provided SVG
 *
 * POST /api/qr/render
 *
 * Body:
 * - svg: SVG content string
 * - size: Output size (default 512)
 * - quality: PNG quality (default 90)
 * - format: Output format (png, base64, dataurl)
 */
exports.renderQRCode = async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            svg,
            size = 512,
            quality = 90,
            format = 'base64',
            transparent = false,
        } = req.body;

        if (!svg) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'SVG content is required',
                },
            });
        }

        // Check cache
        const cacheKey = cacheService.generateKey({ svg, size, quality, transparent });
        const cachedPng = await cacheService.get(cacheKey);

        let pngBuffer;
        if (cachedPng) {
            pngBuffer = cachedPng;
        } else {
            pngBuffer = await svgToPngService.convert(svg, {
                size,
                quality,
                transparent,
            });
            await cacheService.set(cacheKey, pngBuffer);
        }

        const duration = Date.now() - startTime;

        // Return based on requested format
        switch (format) {
            case 'binary':
            case 'png':
                res.set({
                    'Content-Type': 'image/png',
                    'Content-Length': pngBuffer.length,
                    'X-Generation-Time': `${duration}ms`,
                });
                return res.send(pngBuffer);

            case 'dataurl':
                return res.json({
                    success: true,
                    data: {
                        dataurl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
                        size: `${size}x${size}`,
                        bytes: pngBuffer.length,
                        cached: !!cachedPng,
                        generation_ms: duration,
                    },
                });

            case 'base64':
            default:
                return res.json({
                    success: true,
                    data: {
                        png_base64: pngBuffer.toString('base64'),
                        format: 'png',
                        size: `${size}x${size}`,
                        bytes: pngBuffer.length,
                        cached: !!cachedPng,
                        generation_ms: duration,
                    },
                });
        }
    } catch (error) {
        logger.error(`QR render failed: ${error.message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'RENDER_FAILED',
                message: `Failed to render QR code: ${error.message}`,
            },
        });
    }
};

/**
 * Get QR code PNG by ID
 *
 * GET /api/qr/:id/png
 *
 * Query params:
 * - size: Output size (default 512)
 * - quality: PNG quality (default 90)
 */
exports.getQRCodePng = async (req, res) => {
    const startTime = Date.now();

    try {
        const { id } = req.params;
        const size = parseInt(req.query.size) || 512;
        const quality = parseInt(req.query.quality) || 90;
        const authToken = req.headers['authorization'];

        if (!authToken) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authorization token is required',
                },
            });
        }

        // Check cache
        const cacheKey = cacheService.generateKey({ qr_id: id, size, quality });
        const cachedPng = await cacheService.get(cacheKey);

        if (cachedPng) {
            const duration = Date.now() - startTime;
            res.set({
                'Content-Type': 'image/png',
                'Content-Length': cachedPng.length,
                'Cache-Control': 'public, max-age=3600',
                'X-Cache': 'HIT',
                'X-Generation-Time': `${duration}ms`,
            });
            return res.send(cachedPng);
        }

        // Get SVG from Laravel
        const svgContent = await laravelService.getQRCodeSvg(id, authToken);

        // Convert to PNG
        const pngBuffer = await svgToPngService.convert(svgContent, {
            size,
            quality,
        });

        // Cache the result
        await cacheService.set(cacheKey, pngBuffer, 3600); // 1 hour cache

        const duration = Date.now() - startTime;

        res.set({
            'Content-Type': 'image/png',
            'Content-Length': pngBuffer.length,
            'Content-Disposition': `inline; filename="qrcode-${id}.png"`,
            'Cache-Control': 'public, max-age=3600',
            'X-Cache': 'MISS',
            'X-Generation-Time': `${duration}ms`,
        });
        res.send(pngBuffer);
    } catch (error) {
        logger.error(`Get QR PNG failed: ${error.message}`);

        // Handle Laravel errors
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                error: {
                    code: 'LARAVEL_ERROR',
                    message: error.message || 'Failed to fetch QR code from backend',
                },
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'PNG_FAILED',
                message: `Failed to generate PNG: ${error.message}`,
            },
        });
    }
};
