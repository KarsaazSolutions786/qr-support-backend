/**
 * Preview Controller
 *
 * Handles QR code preview generation requests.
 * Fetches SVG from Laravel backend, preprocesses for compatibility,
 * and converts to PNG for Flutter.
 *
 * Architecture:
 * Flutter → Node.js → Laravel (SVG) → SVGPreprocessor → Sharp (PNG) → Flutter
 */

const QRCodeGenerator = require('../services/qr/QRCodeGenerator');
const QRDataEncoder = require('../services/qr/QRDataEncoder');
const laravelProxyService = require('../services/LaravelProxyService');

const generator = new QRCodeGenerator();
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
 * - design: Design configuration (all Laravel features supported)
 * - size: Output size (default 512)
 * - quality: PNG quality (default 90)
 * - force_png: Always return PNG (default true)
 * - use_laravel: Use Laravel backend for full feature support (default true)
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
            use_laravel = true,
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
            source: use_laravel ? 'laravel' : 'node',
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

        // Check for themed shape - requires specialized handling via LaravelProxyService
        if (design.themed_shape || design.shape) {
            try {
                logger.info(`Delegating themed shape generation to Laravel: ${design.themed_shape || design.shape}`);

                const pngBuffer = await laravelProxyService.generateWithThemedShape(
                    design,
                    data,
                    type,
                    size
                );

                const duration = Date.now() - startTime;

                return res.json({
                    success: true,
                    data: {
                        rendering_strategy: 'server',
                        strategy_reason: 'themed_shape',
                        design: design,
                        images: {
                            png_base64: pngBuffer.toString('base64'),
                            format: 'png',
                            size: `${size}x${size}`,
                        },
                        meta: {
                            type,
                            cached: false,
                            node_processed: false,
                            laravel_source: true,
                            generation_ms: duration,
                        },
                    },
                });
            } catch (proxyError) {
                logger.error(`Themed shape generation failed: ${proxyError.message}`);
                // Fall through to regular Node generation as fallback, or return error?
                // For themed shapes, fallback doesn't make sense as Node can't render them.
                return res.status(502).json({
                    success: false,
                    error: {
                        code: 'THEMED_GENERATION_FAILED',
                        message: `Failed to generate themed QR: ${proxyError.message}`
                    }
                });
            }
        }

        let pngBuffer;
        let strategyReason;

        // Check if design requires Laravel features (gradients, shapes, logos, etc.)
        const requiresLaravelFeatures = checkLaravelFeatures(design);

        if (use_laravel && requiresLaravelFeatures) {
            // Use Laravel backend for full feature support
            logger.debug(`Using Laravel for full feature support: type=${type}`);
            logger.debug(`Design features: ${JSON.stringify(design)}`);

            try {
                // Fetch SVG from Laravel with all design features
                const laravelResponse = await laravelService.getPreviewSvg({
                    type,
                    data,
                    design,
                    size,
                });

                // Response is normalized by laravelService
                if (laravelResponse.success !== false && laravelResponse.data?.svg) {
                    const svgContent = laravelResponse.data.svg;

                    logger.debug(`Laravel SVG received: ${svgContent.substring(0, 200)}...`);

                    // Preprocess SVG for Sharp/Flutter compatibility
                    logger.debug('Preprocessing SVG for Sharp compatibility...');
                    const processedSvg = svgPreprocessor.process(svgContent, design);

                    logger.debug(`Preprocessed SVG: ${processedSvg.substring(0, 200)}...`);

                    // Convert preprocessed SVG to PNG
                    pngBuffer = await svgToPngService.convert(processedSvg, {
                        width: size,
                        height: size,
                        quality,
                        background: design.background_color || design.backgroundColor,
                        preprocessed: true, // SVG is already preprocessed
                    });

                    strategyReason = 'laravel_converted';
                    logger.debug(`Laravel SVG converted to PNG: ${pngBuffer.length} bytes`);
                } else {
                    logger.warn('Laravel response missing SVG, raw response:', JSON.stringify(laravelResponse.raw || laravelResponse));
                    throw new Error('Laravel response missing SVG content');
                }
            } catch (laravelError) {
                logger.warn(`Laravel fetch failed, falling back to Node.js: ${laravelError.message}`);
                if (laravelError.data) {
                    logger.warn(`Laravel error details: ${JSON.stringify(laravelError.data)}`);
                }
                // Fall back to Node.js generation
                pngBuffer = await generateWithNode(type, data, design, size, quality);
                strategyReason = 'node_fallback';
            }
        } else {
            // Use Node.js for simple QR codes (no advanced styling)
            logger.debug(`Using Node.js for simple QR: type=${type}`);
            pngBuffer = await generateWithNode(type, data, design, size, quality);
            strategyReason = 'node_generated';
        }

        const pngBase64 = pngBuffer.toString('base64');

        // Cache the result
        await cacheService.set(cacheKey, pngBuffer);

        const duration = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                rendering_strategy: 'server',
                strategy_reason: strategyReason,
                design: design,
                images: {
                    png_base64: pngBase64,
                    format: 'png',
                    size: `${size}x${size}`,
                },
                meta: {
                    type,
                    cached: false,
                    node_processed: true,
                    laravel_source: strategyReason === 'laravel_converted',
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

/**
 * Check if design requires Laravel features
 */
function checkLaravelFeatures(design) {
    // Node.js now handles all features - no need for Laravel
    return false;
}

/**
 * Generate QR code using Node.js
 */
async function generateWithNode(type, data, design, size, quality) {
    logger.debug('Generating QR with Node.js QRCodeGenerator');
    const result = await generator.generatePreview(type, data, design, {
        size: parseInt(size) || 512,
        quality: parseInt(quality) || 90,
    });
    // Return PNG buffer
    return Buffer.from(result.pngBase64, 'base64');
}

/**
 * Generate preview PNG from Laravel SVG - always uses Laravel
 *
 * POST /api/qr/preview/laravel
 *
 * This endpoint always fetches from Laravel for full feature support.
 * Use this when you need all Laravel QR features.
 */
exports.generateFromLaravel = async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            type = 'url',
            data = {},
            design = {},
            size = 512,
            quality = 90,
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

        // Check cache
        const cacheKey = cacheService.generateKey({
            type,
            data,
            design,
            size,
            quality,
            source: 'laravel_explicit',
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

        logger.info(`Generating preview from Laravel: type=${type}`);
        logger.debug(`Design: ${JSON.stringify(design)}`);

        // Always fetch from Laravel
        const laravelResponse = await laravelService.getPreviewSvg({
            type,
            data,
            design,
            size,
        });

        if (laravelResponse.success !== false && laravelResponse.data?.svg) {
            const svgContent = laravelResponse.data.svg;

            logger.debug(`Laravel SVG length: ${svgContent.length}`);

            // Preprocess SVG for Sharp/Flutter compatibility
            const processedSvg = svgPreprocessor.process(svgContent, design);

            // Convert to PNG
            const pngBuffer = await svgToPngService.convert(processedSvg, {
                width: size,
                height: size,
                quality,
                background: design.background_color || design.backgroundColor,
                preprocessed: true,
            });

            // Cache result
            await cacheService.set(cacheKey, pngBuffer);

            const duration = Date.now() - startTime;

            res.json({
                success: true,
                data: {
                    rendering_strategy: 'server',
                    strategy_reason: 'laravel_converted',
                    design: design,
                    images: {
                        png_base64: pngBuffer.toString('base64'),
                        format: 'png',
                        size: `${size}x${size}`,
                    },
                    meta: {
                        type,
                        cached: false,
                        node_processed: true,
                        laravel_source: true,
                        generation_ms: duration,
                    },
                },
            });
        } else {
            throw new Error('Laravel did not return SVG content');
        }
    } catch (error) {
        logger.error(`Laravel preview generation failed: ${error.message}`);

        if (error.status && error.data) {
            return res.status(error.status).json(error.data);
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'LARAVEL_PREVIEW_FAILED',
                message: `Failed to generate preview from Laravel: ${error.message}`,
            },
        });
    }
};

/**
 * Get supported features and capabilities
 *
 * GET /api/qr/capabilities
 */
exports.getCapabilities = async (req, res) => {
    try {
        const capabilities = QRCodeGenerator.getCapabilities();
        res.json({
            success: true,
            data: {
                version: capabilities.version,
                architecture: 'standalone',
                types: capabilities.types,
                features: {
                    module_shapes: capabilities.features.modules.shapes,
                    finder_shapes: capabilities.features.finders.shapes,
                    finder_dot_shapes: capabilities.features.finders.dotShapes,
                    colors: { foreground: true, background: true, eye_internal: true, eye_external: true },
                    gradients: capabilities.features.colors.gradientTypes,
                    logo: {
                        supported: true,
                        formats: ['png', 'jpg', 'svg', 'gif', 'webp'],
                        background_shapes: capabilities.features.logo.backgroundShapes,
                    },
                    frames: capabilities.features.frames?.types || [],
                    error_correction: capabilities.features.errorCorrection,
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                code: 'CAPABILITIES_ERROR',
                message: error.message,
            },
        });
    }
};

/**
 * Get available themed shapes from Laravel
 * 
 * GET /api/qr/themed-shapes
 */
exports.getThemedShapes = async (req, res) => {
    try {
        const shapes = await laravelProxyService.getThemedShapes();
        res.json({
            success: true,
            data: shapes
        });
    } catch (error) {
        res.status(502).json({
            success: false,
            error: {
                code: 'PROXY_ERROR',
                message: error.message
            }
        });
    }
};
