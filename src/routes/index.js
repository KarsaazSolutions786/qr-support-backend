/**
 * API Routes
 *
 * QR Support Backend Routes
 * Architecture: Flutter → Node.js → Laravel (SVG) → Preprocessor → Sharp (PNG) → Flutter
 *
 * V2 API: Direct QR generation without Laravel dependency
 */

const express = require('express');
const router = express.Router();

const qrController = require('../controllers/qrController');
const previewController = require('../controllers/previewController');
const proxyController = require('../controllers/proxyController');
const qrV2Controller = require('../controllers/qrV2Controller');

// ============================================================
// V2 API Routes - Standalone QR generation (no Laravel dependency)
// ============================================================

// Generate full QR code with all styling
router.post('/v2/qr/generate', qrV2Controller.generate);

// Quick preview (optimized for speed)
router.post('/v2/qr/preview', qrV2Controller.preview);

// Get V2 capabilities
router.get('/v2/qr/capabilities', qrV2Controller.getCapabilities);

// Validate design before generation
router.post('/v2/qr/validate', qrV2Controller.validateDesign);

// Batch generation
router.post('/v2/qr/batch', qrV2Controller.batch);

// ============================================================
// V1 API Routes - Laravel-dependent (legacy)
// ============================================================

// QR Code rendering endpoints
// Main preview endpoint - auto-detects if Laravel features are needed
router.post('/qr/preview', previewController.generatePreview);

// Laravel-explicit endpoint - always uses Laravel for full feature support
router.post('/qr/preview/laravel', previewController.generateFromLaravel);

// Get supported capabilities
router.get('/qr/capabilities', previewController.getCapabilities);

// Get available themed shapes
router.get('/qr/themed-shapes', previewController.getThemedShapes);

// Legacy endpoints
router.post('/qr/render', qrController.renderQRCode);
router.get('/qr/:id/png', qrController.getQRCodePng);

// Direct proxy to Laravel (with auth passthrough)
router.all('/proxy/*', proxyController.proxyRequest);

// Feature discovery
router.get('/features', (req, res) => {
    res.json({
        success: true,
        data: {
            version: '2.0.0',
            capabilities: {
                svg_to_png: true,
                laravel_conversion: true,
                svg_preprocessing: true,
                standalone_generation: true,
                caching: process.env.CACHE_ENABLED === 'true',
                max_size: parseInt(process.env.MAX_PNG_SIZE) || 2048,
                supported_formats: ['png', 'jpeg', 'webp'],
            },
            endpoints: {
                // V2 API - Standalone (recommended)
                v2_generate: '/api/v2/qr/generate',
                v2_preview: '/api/v2/qr/preview',
                v2_capabilities: '/api/v2/qr/capabilities',
                v2_validate: '/api/v2/qr/validate',
                v2_batch: '/api/v2/qr/batch',
                // V1 API - Laravel-dependent (legacy)
                preview: '/api/qr/preview',
                preview_laravel: '/api/qr/preview/laravel',
                capabilities: '/api/qr/capabilities',
                render: '/api/qr/render',
                png: '/api/qr/:id/png',
                proxy: '/api/proxy/*',
            },
            laravel_features: [
                'module_shapes',
                'finder_patterns',
                'finder_dots',
                'colors',
                'gradients',
                'eye_colors',
                'logo_embedding',
                'advanced_shapes',
                'outlined_shapes',
            ],
            v2_features: [
                'colors',
                'gradients (linear/radial)',
                'eye_colors',
                'basic_module_shapes',
                'basic_finder_patterns',
            ],
        },
    });
});

module.exports = router;
