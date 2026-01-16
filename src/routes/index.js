/**
 * API Routes
 */

const express = require('express');
const router = express.Router();

const qrController = require('../controllers/qrController');
const previewController = require('../controllers/previewController');
const proxyController = require('../controllers/proxyController');

// QR Code rendering endpoints
router.post('/qr/preview', previewController.generatePreview);
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
                caching: process.env.CACHE_ENABLED === 'true',
                max_size: parseInt(process.env.MAX_PNG_SIZE) || 2048,
                supported_formats: ['png', 'jpeg', 'webp'],
            },
            endpoints: {
                preview: '/api/qr/preview',
                render: '/api/qr/render',
                png: '/api/qr/:id/png',
                proxy: '/api/proxy/*',
            },
        },
    });
});

module.exports = router;
