/**
 * Preview Controller (Refactored)
 *
 * Handles QR code preview generation requests.
 * 
 * IMPORTANT CHANGE: Always uses Laravel for QR generation.
 * This ensures Flutter QR codes look IDENTICAL to web QR codes.
 *
 * Architecture:
 * Flutter → Node.js → Laravel (SVG) → SVGPreprocessor → Sharp (PNG) → Flutter
 */

const laravelService = require('../services/laravelService');
const svgPreprocessor = require('../services/svgPreprocessor');
const svgToPngService = require('../services/svgToPngService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const { normalizeRequestForLaravel, getDesignParam } = require('../utils/parameterNormalizer');

/**
 * Fix transform-origin for Sharp/libvips compatibility
 * Converts transform-origin to equivalent translate operations
 *
 * Sharp/libvips doesn't support the transform-origin CSS property, so we need to convert:
 * transform="rotate(45) scale(0.5)" transform-origin="100 100"
 * Into:
 * transform="translate(100, 100) rotate(45) scale(0.5) translate(-100, -100)"
 */
function fixTransformOrigin(svg) {
    // Handle transform-origin that comes AFTER transform
    svg = svg.replace(
        /(<\w+[^>]*?)\s+transform=["']([^"']*)["']([^>]*?)\s+transform-origin=["']([^"']*)["']([^>]*?>)/gi,
        (match, before, transform, middle, origin, after) => {
            const originParts = origin.trim().split(/[\s,]+/);
            const ox = parseFloat(originParts[0]) || 0;
            const oy = parseFloat(originParts[1] || originParts[0]) || 0;

            // Wrap transform with translate operations
            const newTransform = `translate(${ox}, ${oy}) ${transform} translate(${-ox}, ${-oy})`;

            return `${before} transform="${newTransform}"${middle}${after}`;
        }
    );

    // Handle transform-origin that comes BEFORE transform
    svg = svg.replace(
        /(<\w+[^>]*?)\s+transform-origin=["']([^"']*)["']([^>]*?)\s+transform=["']([^"']*)["']([^>]*?>)/gi,
        (match, before, origin, middle, transform, after) => {
            const originParts = origin.trim().split(/[\s,]+/);
            const ox = parseFloat(originParts[0]) || 0;
            const oy = parseFloat(originParts[1] || originParts[0]) || 0;

            // Wrap transform with translate operations
            const newTransform = `translate(${ox}, ${oy}) ${transform} translate(${-ox}, ${-oy})`;

            return `${before}${middle} transform="${newTransform}"${after}`;
        }
    );

    // Remove any remaining standalone transform-origin attributes
    svg = svg.replace(/\s+transform-origin=["'][^"']*["']/gi, '');

    return svg;
}

/**
 * Generate preview PNG from design data
 *
 * POST /api/qr/preview
 *
 * ALWAYS proxies to Laravel for full feature parity with web frontend.
 *
 * Body:
 * - type: QR code type (url, text, vcard, etc.)
 * - data: QR code data (url, text content, etc.)
 * - design: Design configuration (all Laravel features supported)
 * - size: Output size (default 512)
 * - quality: PNG quality (default 90)
 */
exports.generatePreview = async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    logger.debug(`[${requestId}] QR preview request`);

    try {
        const {
            type = 'url',
            data = {},
            design = {},
            size = 512,
            quality = 90,
        } = req.body;

        logger.debug(`[${requestId}] Type: ${type}, Size: ${size}`);

        // Validate required fields
        if (!data || Object.keys(data).length === 0) {
            logger.warn(`[${requestId}] Missing QR data`);
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
            source: 'laravel_always', // New cache key to distinguish from old logic
        });

        const cachedPng = await cacheService.get(cacheKey);
        if (cachedPng) {
            const duration = Date.now() - startTime;
            logger.debug(`[${requestId}] Cache HIT (${duration}ms)`);
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
                        request_id: requestId,
                    },
                },
            });
        }

        // Generate from Laravel
        let pngBuffer;
        let strategyReason;

        try {
            const laravelResponse = await laravelService.getPreviewSvg({
                type,
                data,
                design,
                size,
            });

            if (laravelResponse.success !== false && laravelResponse.data?.svg) {
                const svgContent = laravelResponse.data.svg;

                // Only apply transform-origin fix (needed for logo centering)
                // Skip full SVG preprocessing which can corrupt embedded base64 image data
                let processedSvg = fixTransformOrigin(svgContent);

                // Ensure XML declaration
                if (!processedSvg.startsWith('<?xml')) {
                    processedSvg = '<?xml version="1.0" encoding="UTF-8"?>\n' + processedSvg;
                }

                logger.debug(`[${requestId}] SVG transform-origin fixed for Sharp compatibility`);

                // Convert to PNG
                pngBuffer = await svgToPngService.convert(processedSvg, {
                    width: size,
                    height: size,
                    quality,
                    background: getDesignParam(design, 'background_color'),
                    preprocessed: true,
                });

                strategyReason = 'laravel_converted';
                logger.debug(`[${requestId}] Generated PNG (${pngBuffer.length} bytes)`);

            } else {
                logger.error(`[${requestId}] Laravel response missing SVG`);
                throw new Error('Laravel response missing SVG content');
            }

        } catch (laravelError) {
            logger.error(`[${requestId}] Laravel failed: ${laravelError.message}`);

            // Return error to Flutter - don't try to generate locally
            // This ensures we always know when something is wrong
            return res.status(500).json({
                success: false,
                error: {
                    code: 'LARAVEL_ERROR',
                    message: `QR generation failed: ${laravelError.message}`,
                    details: laravelError.data || null,
                },
                meta: {
                    request_id: requestId,
                },
            });
        }

        // Convert to base64 and cache
        const pngBase64 = pngBuffer.toString('base64');
        await cacheService.set(cacheKey, pngBuffer);

        const duration = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                rendering_strategy: 'server',
                strategy_reason: strategyReason,
                images: {
                    png_base64: pngBase64,
                    format: 'png',
                    size: `${size}x${size}`,
                },
                meta: {
                    type,
                    cached: false,
                    node_processed: true,
                    laravel_source: true,
                    generation_ms: duration,
                    request_id: requestId,
                },
            },
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`[${requestId}] Failed: ${error.message} (${duration}ms)`);

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
            meta: {
                request_id: requestId,
            },
        });
    }
};

/**
 * Generate preview PNG from Laravel - explicit endpoint
 *
 * POST /api/qr/preview/laravel
 *
 * This endpoint is now identical to the main preview endpoint
 * since we always use Laravel.
 */
exports.generateFromLaravel = async (req, res) => {
    // Delegate to main preview handler since they're now the same
    return exports.generatePreview(req, res);
};

/**
 * Get supported features and capabilities
 *
 * GET /api/qr/capabilities
 */
exports.getCapabilities = async (req, res) => {
    try {
        // Get capabilities from Laravel to ensure accuracy
        let laravelCapabilities = {};
        try {
            laravelCapabilities = await laravelService.getCapabilities();
        } catch (e) {
            logger.warn(`Could not fetch Laravel capabilities: ${e.message}`);
        }

        res.json({
            success: true,
            data: {
                version: '3.0.0', // Updated version
                architecture: 'laravel_proxy', // Clearly indicate we proxy to Laravel
                description: 'All QR generation is handled by Laravel for feature parity with web',
                node_features: {
                    svg_to_png: true,
                    svg_preprocessing: true,
                    caching: process.env.CACHE_ENABLED === 'true',
                    max_size: parseInt(process.env.MAX_PNG_SIZE) || 2048,
                    supported_formats: ['png'],
                },
                laravel_features: laravelCapabilities.data || {
                    module_shapes: 'All 60+ shapes supported',
                    finder_patterns: 'All patterns supported',
                    finder_dots: 'All dot shapes supported',
                    colors: 'Full color customization',
                    gradients: 'Linear and radial gradients',
                    logos: 'All logo options',
                    stickers: 'All sticker/advanced shapes',
                    themed_shapes: 'All 65+ themed shapes',
                },
                endpoints: {
                    preview: '/api/qr/preview',
                    preview_laravel: '/api/qr/preview/laravel',
                    capabilities: '/api/qr/capabilities',
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
 * Debug endpoint to test Laravel connectivity
 * 
 * GET /api/qr/debug/laravel
 */
exports.debugLaravel = async (req, res) => {
    try {
        const health = await laravelService.healthCheck();

        res.json({
            success: true,
            data: {
                laravel_url: process.env.LARAVEL_BACKEND_URL || 'http://localhost:8000',
                laravel_health: health,
                node_env: process.env.NODE_ENV || 'development',
                cache_enabled: process.env.CACHE_ENABLED === 'true',
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                code: 'DEBUG_ERROR',
                message: error.message,
            },
        });
    }
};
