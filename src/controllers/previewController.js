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
const laravelService = require('../services/laravelService');
const svgPreprocessor = require('../services/svgPreprocessor');
const svgToPngService = require('../services/svgToPngService');

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
    console.log('\n\n🚀🚀🚀 GENERATEPREVIEW CALLED 🚀🚀🚀');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀\n');

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
                logger.debug('Laravel response received:', JSON.stringify({
                    success: laravelResponse.success,
                    hasSvg: !!laravelResponse.data?.svg,
                    dataKeys: laravelResponse.data ? Object.keys(laravelResponse.data) : [],
                    rawKeys: laravelResponse.raw ? Object.keys(laravelResponse.raw) : []
                }));

                if (laravelResponse.success !== false && laravelResponse.data?.svg) {
                    const svgContent = laravelResponse.data.svg;

                    logger.info(`✅ Laravel SVG received successfully (${svgContent.length} bytes)`);
                    logger.debug(`SVG preview: ${svgContent.substring(0, 200)}...`);

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
                    logger.info(`✅ Laravel SVG converted to PNG: ${pngBuffer.length} bytes`);
                } else {
                    logger.error('❌ Laravel response missing SVG!');
                    logger.error('Response success:', laravelResponse.success);
                    logger.error('Has data.svg:', !!laravelResponse.data?.svg);
                    if (laravelResponse.raw) {
                        logger.error('Raw response keys:', Object.keys(laravelResponse.raw).join(', '));
                        logger.error('Raw response:', JSON.stringify(laravelResponse.raw, null, 2));
                    }
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
 * 
 * Returns true if the design uses features that require Laravel's advanced processors:
 * - Themed shapes (60+ shapes like star, heart, apple, etc.)
 * - Advanced frames (coupon, healthcare, etc.)
 * - Stickers
 * 
 * Module shapes, finders, and finder dots are handled by Node.js
 */
function checkLaravelFeatures(design) {
    console.log('\n🔍 checkLaravelFeatures CALLED');
    console.log('Design:', JSON.stringify(design, null, 2));

    // List of all 65 themed shapes that require Laravel
    const themedShapes = [
        // Food & Beverage (10)
        'apple', 'bakery', 'burger', 'cooking', 'cup', 'food',
        'ice-cream', 'juice', 'pizza', 'restaurant', 'shawarma', 'water-glass',
        // Business & Commerce (9)
        'bag', 'gift', 'shopping-cart', 'piggy-bank', 'realtor',
        'realtor-sign', 'search', 'ticket', 'trophy', 'travel',
        // Services (14)
        'builder', 'dentist', 'electrician', 'furniture', 'gardening',
        'golf', 'legal', 'locksmith', 'painter', 'pest', 'plumber',
        'salon', 'gym', 'home-mover', 'pet',
        // Technology & Objects (18)
        'book', 'boot', 'bulb', 'car', 'cloud', 'home',
        'message', 'mobile', 'star', 'sun', 'sunrise',
        'teddy', 'truck', 'umbrella', 'van', 'watch',
        'barn', 'shirt', 'circle', 'shield',
        // Nature & Health (8)
        'brain', 'leaf', 'tree', 'water', 'flower',
        'heart', 'fish', 'bear',
    ];

    // Check for themed shape (both snake_case and camelCase)
    const themedShape = design.themed_shape || design.themedShape || design.shape;
    console.log('Themed shape found:', themedShape);

    if (themedShape && themedShape !== 'none' && themedShapes.includes(themedShape.toLowerCase())) {
        console.log('✅✅ DETECTED: Themed shape requires Laravel!');
        logger.debug(`Laravel required: themed shape '${themedShape}' detected`);
        return true;
    }

    // Check for advanced frames
    const advancedShape = design.advanced_shape || design.advancedShape;
    if (advancedShape && advancedShape !== 'none') {
        console.log('✅ DETECTED: Advanced frame requires Laravel!');
        logger.debug(`Laravel required: advanced frame '${advancedShape}' detected`);
        return true;
    }

    // Check for stickers
    if (design.sticker && design.sticker !== 'none') {
        console.log('✅ DETECTED: Sticker requires Laravel!');
        logger.debug(`Laravel required: sticker detected`);
        return true;
    }

    // All other features (modules, finders, finder dots, colors, gradients, logos)
    // are handled by Node.js
    console.log('❌ No Laravel features detected, using Node.js');
    logger.debug('No Laravel features required, using Node.js');
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
