/**
 * Preview Controller
 *
 * Handles QR code preview generation requests.
 * Generates styled QR codes directly in Node.js for full control.
 */

const laravelService = require('../services/laravelService');
const svgToPngService = require('../services/svgToPngService');
const qrGeneratorService = require('../services/qrGeneratorService');
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

        // Generate QR code directly in Node.js for full styling control
        logger.debug(`Generating QR directly: type=${type}, fg=${design.foreground_color}`);

        // Encode data based on QR type
        const qrPayload = qrGeneratorService.encodeData(type, data);
        logger.debug(`Encoded payload: ${qrPayload.substring(0, 100)}...`);

        // Generate styled QR code as PNG
        const pngBuffer = await qrGeneratorService.generate(qrPayload, design, size, quality);
        const pngBase64 = pngBuffer.toString('base64');

        // Cache the result
        await cacheService.set(cacheKey, pngBuffer);

        const duration = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                rendering_strategy: 'server',
                strategy_reason: 'node_generated',
                qr_payload: qrPayload,
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
                    node_generated: true,
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
