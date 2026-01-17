/**
 * QR V2 Controller - New API endpoints for full QR code generation
 *
 * These endpoints use the new QRCodeGenerator which handles all QR styling
 * without depending on Laravel for image generation.
 *
 * Endpoints:
 * - POST /api/v2/qr/generate     - Generate QR code (SVG + PNG)
 * - POST /api/v2/qr/preview      - Quick preview
 * - GET  /api/v2/qr/capabilities - Get supported features
 * - POST /api/v2/qr/validate     - Validate design before generation
 * - POST /api/v2/qr/batch        - Generate multiple QR codes
 */
const QRCodeGenerator = require('../services/qr/QRCodeGenerator');
const QRDataEncoder = require('../services/qr/QRDataEncoder');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// Create singleton generator instance
const generator = new QRCodeGenerator();

/**
 * Generate a full QR code with all styling
 *
 * POST /api/v2/qr/generate
 *
 * Body:
 * {
 *   type: "url" | "text" | "email" | "phone" | "sms" | "wifi" | "vcard" | "location" | "event" | "whatsapp" | "social" | "crypto" | "upi" | "pix",
 *   data: { ... },  // Type-specific data
 *   design: { ... }, // Design configuration
 *   options: {
 *     size: 512,      // Output size
 *     format: "both", // "svg" | "png" | "both"
 *     quality: 90,    // PNG quality (1-100)
 *     transparent: false, // Transparent background for PNG
 *   }
 * }
 */
async function generate(req, res) {
    const startTime = Date.now();

    try {
        const { type, data, design = {}, options = {} } = req.body;

        // Validate required fields
        if (!type) {
            return res.status(400).json({
                success: false,
                error: 'Type is required',
                code: 'MISSING_TYPE',
            });
        }

        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Data is required',
                code: 'MISSING_DATA',
            });
        }

        // Validate type is supported
        if (!QRDataEncoder.isTypeSupported(type)) {
            return res.status(400).json({
                success: false,
                error: `Unsupported QR type: ${type}`,
                code: 'UNSUPPORTED_TYPE',
                supportedTypes: QRDataEncoder.getSupportedTypes(),
            });
        }

        // Parse size and validate
        const size = parseInt(options.size) || 512;
        if (size < 64 || size > 2048) {
            return res.status(400).json({
                success: false,
                error: 'Size must be between 64 and 2048',
                code: 'INVALID_SIZE',
            });
        }

        // Check cache
        const cacheKey = cacheService.generateKey({ type, data, design, size });
        const cachedResult = await cacheService.get(cacheKey);

        if (cachedResult) {
            logger.debug(`Cache hit for QR generation: ${cacheKey}`);
            return res.json({
                success: true,
                data: {
                    ...JSON.parse(cachedResult),
                    meta: {
                        ...JSON.parse(cachedResult).meta,
                        cached: true,
                        totalMs: Date.now() - startTime,
                    },
                },
            });
        }

        // Generate QR code
        const result = await generator.generate(type, data, design, {
            size,
            quality: options.quality || 90,
            transparent: options.transparent || false,
        });

        // Prepare response based on format requested
        const format = options.format || 'both';
        const response = {
            images: {},
            meta: {
                ...result.meta,
                format,
                cached: false,
                totalMs: Date.now() - startTime,
            },
        };

        if (format === 'svg' || format === 'both') {
            response.images.svg = result.svg;
            response.images.svgBase64 = result.svgBase64;
        }

        if (format === 'png' || format === 'both') {
            response.images.pngBase64 = result.pngBase64;
        }

        // Cache the result
        const cacheData = JSON.stringify(response);
        await cacheService.set(cacheKey, cacheData, 300); // 5 minute TTL

        return res.json({
            success: true,
            data: response,
        });

    } catch (error) {
        logger.error(`QR generation error: ${error.message}`, { error: error.stack });

        return res.status(500).json({
            success: false,
            error: error.message,
            code: 'GENERATION_ERROR',
        });
    }
}

/**
 * Generate a quick preview (optimized for speed)
 *
 * POST /api/v2/qr/preview
 *
 * Same body as /generate but uses smaller default size
 */
async function preview(req, res) {
    const startTime = Date.now();

    try {
        const { type, data, design = {}, options = {} } = req.body;

        // Validate required fields
        if (!type || !data) {
            return res.status(400).json({
                success: false,
                error: 'Type and data are required',
                code: 'MISSING_FIELDS',
            });
        }

        // Use smaller size for preview
        const size = parseInt(options.size) || 256;

        // Check cache
        const cacheKey = cacheService.generateKey({ type, data, design, size, preview: true });
        const cachedResult = await cacheService.get(cacheKey);

        if (cachedResult) {
            logger.debug(`Cache hit for preview: ${cacheKey}`);
            return res.json({
                success: true,
                data: {
                    ...JSON.parse(cachedResult),
                    meta: {
                        ...JSON.parse(cachedResult).meta,
                        cached: true,
                        totalMs: Date.now() - startTime,
                    },
                },
            });
        }

        // Generate preview
        const result = await generator.generatePreview(type, data, design, {
            size,
            quality: options.quality || 80,
        });

        const response = {
            images: {
                pngBase64: result.pngBase64,
            },
            meta: {
                ...result.meta,
                preview: true,
                cached: false,
                totalMs: Date.now() - startTime,
            },
        };

        // Cache preview for shorter time
        await cacheService.set(cacheKey, JSON.stringify(response), 120); // 2 minute TTL

        return res.json({
            success: true,
            data: response,
        });

    } catch (error) {
        logger.error(`Preview generation error: ${error.message}`);

        return res.status(500).json({
            success: false,
            error: error.message,
            code: 'PREVIEW_ERROR',
        });
    }
}

/**
 * Get QR generator capabilities
 *
 * GET /api/v2/qr/capabilities
 */
async function getCapabilities(req, res) {
    try {
        const capabilities = QRCodeGenerator.getCapabilities();

        return res.json({
            success: true,
            data: capabilities,
        });

    } catch (error) {
        logger.error(`Capabilities error: ${error.message}`);

        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

/**
 * Validate design before generation
 *
 * POST /api/v2/qr/validate
 *
 * Body:
 * {
 *   type: "url",
 *   data: { ... },
 *   design: { ... }
 * }
 */
async function validateDesign(req, res) {
    try {
        const { type, data, design = {} } = req.body;
        const errors = [];
        const warnings = [];

        // Validate type
        if (!type) {
            errors.push({ field: 'type', message: 'Type is required' });
        } else if (!QRDataEncoder.isTypeSupported(type)) {
            errors.push({
                field: 'type',
                message: `Unsupported type: ${type}`,
                supportedTypes: QRDataEncoder.getSupportedTypes(),
            });
        }

        // Validate data
        if (!data) {
            errors.push({ field: 'data', message: 'Data is required' });
        }

        // Validate design fields
        if (design.foregroundColor && !isValidColor(design.foregroundColor)) {
            errors.push({ field: 'design.foregroundColor', message: 'Invalid color format' });
        }

        if (design.backgroundColor && !isValidColor(design.backgroundColor)) {
            errors.push({ field: 'design.backgroundColor', message: 'Invalid color format' });
        }

        // Validate gradient if present
        if (design.fillType === 'gradient' || design.gradientFill) {
            const gradient = design.gradientFill || design.gradient_fill;
            if (gradient) {
                if (!gradient.colors || !Array.isArray(gradient.colors) || gradient.colors.length < 2) {
                    errors.push({
                        field: 'design.gradientFill.colors',
                        message: 'Gradient must have at least 2 color stops',
                    });
                }
            } else {
                warnings.push({
                    field: 'design.gradientFill',
                    message: 'fillType is gradient but no gradientFill configuration provided',
                });
            }
        }

        // Validate error correction
        const validErrorCorrection = ['L', 'M', 'Q', 'H'];
        if (design.errorCorrection && !validErrorCorrection.includes(design.errorCorrection.toUpperCase())) {
            errors.push({
                field: 'design.errorCorrection',
                message: `Invalid error correction level. Must be one of: ${validErrorCorrection.join(', ')}`,
            });
        }

        // Check for advanced features that are not yet implemented
        const advancedFeatures = [];
        if (design.module && design.module !== 'square') {
            advancedFeatures.push({ feature: 'module shapes', status: 'Phase 2' });
        }
        if (design.finder && design.finder !== 'square') {
            advancedFeatures.push({ feature: 'finder patterns', status: 'Phase 3' });
        }
        if (design.logoUrl) {
            advancedFeatures.push({ feature: 'logo embedding', status: 'Phase 5' });
        }
        if (design.advancedShape && design.advancedShape !== 'none') {
            advancedFeatures.push({ feature: 'advanced shapes', status: 'Phase 6' });
        }

        if (advancedFeatures.length > 0) {
            warnings.push({
                field: 'design',
                message: 'Some features are not yet implemented',
                features: advancedFeatures,
            });
        }

        // Try to encode data to check for issues
        if (type && data && errors.length === 0) {
            try {
                QRDataEncoder.encode(type, data);
            } catch (encodeError) {
                errors.push({
                    field: 'data',
                    message: `Data encoding error: ${encodeError.message}`,
                });
            }
        }

        const isValid = errors.length === 0;

        return res.json({
            success: true,
            data: {
                valid: isValid,
                errors,
                warnings,
            },
        });

    } catch (error) {
        logger.error(`Validation error: ${error.message}`);

        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

/**
 * Generate multiple QR codes in batch
 *
 * POST /api/v2/qr/batch
 *
 * Body:
 * {
 *   items: [
 *     { type, data, design, options },
 *     { type, data, design, options },
 *     ...
 *   ],
 *   options: {
 *     stopOnError: false, // Continue even if one fails
 *   }
 * }
 */
async function batch(req, res) {
    const startTime = Date.now();

    try {
        const { items = [], options: batchOptions = {} } = req.body;
        const stopOnError = batchOptions.stopOnError || false;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required and must not be empty',
                code: 'MISSING_ITEMS',
            });
        }

        if (items.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 items per batch',
                code: 'BATCH_TOO_LARGE',
            });
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
                const { type, data, design = {}, options = {} } = item;

                if (!type || !data) {
                    throw new Error('Type and data are required');
                }

                const result = await generator.generate(type, data, design, {
                    size: options.size || 512,
                    quality: options.quality || 90,
                });

                results.push({
                    index: i,
                    success: true,
                    data: {
                        images: {
                            svgBase64: result.svgBase64,
                            pngBase64: result.pngBase64,
                        },
                        meta: result.meta,
                    },
                });

                successCount++;

            } catch (itemError) {
                errorCount++;

                results.push({
                    index: i,
                    success: false,
                    error: itemError.message,
                });

                if (stopOnError) {
                    break;
                }
            }
        }

        return res.json({
            success: errorCount === 0,
            data: {
                results,
                summary: {
                    total: items.length,
                    success: successCount,
                    errors: errorCount,
                    totalMs: Date.now() - startTime,
                },
            },
        });

    } catch (error) {
        logger.error(`Batch generation error: ${error.message}`);

        return res.status(500).json({
            success: false,
            error: error.message,
            code: 'BATCH_ERROR',
        });
    }
}

/**
 * Helper to validate color format
 */
function isValidColor(color) {
    if (!color) return false;

    // Check hex format
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)) {
        return true;
    }

    // Check rgb/rgba format
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)$/i.test(color)) {
        return true;
    }

    // Check named colors (basic)
    const namedColors = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'transparent'];
    if (namedColors.includes(color.toLowerCase())) {
        return true;
    }

    return false;
}

module.exports = {
    generate,
    preview,
    getCapabilities,
    validateDesign,
    batch,
};
