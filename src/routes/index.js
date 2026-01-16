/**
 * API Routes
 *
 * QR Support Backend Routes
 * Architecture: Flutter → Node.js → Laravel (SVG) → Preprocessor → Sharp (PNG) → Flutter
 */

const express = require('express');
const router = express.Router();

const qrController = require('../controllers/qrController');
const previewController = require('../controllers/previewController');
const proxyController = require('../controllers/proxyController');

// QR Code rendering endpoints
// Main preview endpoint - auto-detects if Laravel features are needed
router.post('/qr/preview', previewController.generatePreview);

// Laravel-explicit endpoint - always uses Laravel for full feature support
router.post('/qr/preview/laravel', previewController.generateFromLaravel);

// Get supported capabilities
router.get('/qr/capabilities', previewController.getCapabilities);

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
            version: '1.0.0',
            capabilities: {
                svg_to_png: true,
                laravel_conversion: true,
                svg_preprocessing: true,
                caching: process.env.CACHE_ENABLED === 'true',
                max_size: parseInt(process.env.MAX_PNG_SIZE) || 2048,
                supported_formats: ['png', 'jpeg', 'webp'],
            },
            endpoints: {
                // Main preview - auto-detects Laravel features
                preview: '/api/qr/preview',
                // Always use Laravel for full features
                preview_laravel: '/api/qr/preview/laravel',
                // Get capabilities
                capabilities: '/api/qr/capabilities',
                // Legacy
                render: '/api/qr/render',
                png: '/api/qr/:id/png',
                // Proxy
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
        },
    });
});

module.exports = router;
