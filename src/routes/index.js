/**
 * API Routes (Refactored)
 *
 * QR Support Backend Routes
 * 
 * ARCHITECTURE UPDATE (v3.0):
 * - ALL QR generation now goes through Laravel
 * - This ensures Flutter QR codes are IDENTICAL to web QR codes
 * - Node.js only handles SVG → PNG conversion
 * 
 * Flow: Flutter → Node.js → Laravel (SVG) → Preprocessor → Sharp (PNG) → Flutter
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const qrController = require('../controllers/qrController');
const previewController = require('../controllers/previewController');
const proxyController = require('../controllers/proxyController');
const qrV2Controller = require('../controllers/qrV2Controller');
const rpcController = require('../controllers/rpcController');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// ============================================================
// Per-endpoint rate limiters
// Heavy render/generate endpoints: 30 req/min per IP
// Preview endpoints: 20 req/min per IP
// Batch endpoint: 10 req/min per IP
// All others keep the global 100/min applied in server.js
// ============================================================

const makeRateLimitResponse = (max, windowSec) => ({
    success: false,
    error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests — limit is ${max} per ${windowSec}s. Please slow down.`,
    },
});

const renderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: makeRateLimitResponse(30, 60),
});

const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: makeRateLimitResponse(20, 60),
});

const batchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: makeRateLimitResponse(10, 60),
});

// ============================================================
// JSON-RPC 2.0 Endpoint (single + batch, dedup, error isolation)
// SECURITY: apiKeyAuth required — this endpoint proxies to Laravel and performs
//           SVG-to-PNG conversion. Without auth any anonymous caller can trigger
//           resource-intensive rendering and exfiltrate data via the proxy.
// ============================================================
router.post('/rpc', apiKeyAuth, rpcController.handle);
router.get('/rpc/methods', rpcController.methods);

// ============================================================
// MAIN API Routes - Laravel Proxy (RECOMMENDED)
// These routes ensure feature parity with web
// ============================================================

/**
 * Main preview endpoint
 * ALWAYS proxies to Laravel for full feature support
 *
 * POST /api/qr/preview
 */
router.post('/qr/preview', previewLimiter, previewController.generatePreview);

/**
 * Laravel-explicit endpoint (same as above, kept for compatibility)
 *
 * POST /api/qr/preview/laravel
 */
router.post('/qr/preview/laravel', previewLimiter, previewController.generateFromLaravel);

/**
 * Get supported capabilities
 * 
 * GET /api/qr/capabilities
 */
router.get('/qr/capabilities', previewController.getCapabilities);

/**
 * Debug endpoint - check Laravel connectivity
 * 
 * GET /api/qr/debug/laravel
 */
router.get('/qr/debug/laravel', previewController.debugLaravel);

// ============================================================
// Legacy endpoints - Still supported
// ============================================================

/**
 * Direct SVG to PNG render
 *
 * POST /api/qr/render
 */
router.post('/qr/render', renderLimiter, apiKeyAuth, qrController.renderQRCode);

/**
 * Get PNG by QR code ID
 * 
 * GET /api/qr/:id/png
 */
router.get('/qr/:id/png', qrController.getQRCodePng);

/**
 * Direct proxy to Laravel (with auth passthrough)
 *
 * ALL /api/proxy/*
 *
 * SECURITY: apiKeyAuth required — without server-to-server key validation any
 * anonymous client can proxy arbitrary requests to the Laravel backend,
 * bypassing the allow-list at the network layer.
 */
router.all('/proxy/*', apiKeyAuth, proxyController.proxyRequest);

// ============================================================
// V2 API Routes - Direct generation (for simple cases)
// NOTE: For full feature parity, use the main /qr/preview endpoint
// ============================================================

router.post('/v2/qr/generate', renderLimiter, apiKeyAuth, qrV2Controller.generate);
router.post('/v2/qr/preview', previewLimiter, apiKeyAuth, qrV2Controller.preview);
router.get('/v2/qr/capabilities', qrV2Controller.getCapabilities);
router.post('/v2/qr/validate', qrV2Controller.validateDesign);
router.post('/v2/qr/batch', batchLimiter, apiKeyAuth, qrV2Controller.batch);

// ============================================================
// Feature discovery
// ============================================================

router.get('/features', (req, res) => {
    res.json({
        success: true,
        data: {
            version: '3.0.0',
            architecture: 'laravel_proxy',
            description: 'All QR generation proxied to Laravel for feature parity with web',
            capabilities: {
                svg_to_png: true,
                laravel_proxy: true,
                svg_preprocessing: true,
                caching: process.env.CACHE_ENABLED === 'true',
                max_size: parseInt(process.env.MAX_PNG_SIZE) || 2048,
                supported_formats: ['png'],
            },
            recommended_endpoints: {
                preview: '/api/qr/preview (RECOMMENDED - uses Laravel)',
                capabilities: '/api/qr/capabilities',
                debug: '/api/qr/debug/laravel',
            },
            legacy_endpoints: {
                v2_generate: '/api/v2/qr/generate',
                v2_preview: '/api/v2/qr/preview',
                render: '/api/qr/render',
                png: '/api/qr/:id/png',
                proxy: '/api/proxy/*',
            },
            laravel_features: [
                'All 60+ module shapes',
                'All finder patterns',
                'All finder dot shapes',
                'Full color customization',
                'Linear and radial gradients',
                'Eye colors',
                'Logo embedding with all options',
                'All stickers/advanced shapes',
                'All 65+ themed/outlined shapes',
            ],
        },
    });
});

// ============================================================
// Health check
// ============================================================

router.get('/health', async (req, res) => {
    const laravelService = require('../services/laravelService');

    let laravelHealth = { healthy: false, error: 'Not checked' };
    try {
        laravelHealth = await laravelService.healthCheck();
    } catch (e) {
        laravelHealth = { healthy: false, error: e.message };
    }

    res.json({
        success: true,
        data: {
            node: {
                healthy: true,
                version: '3.0.0',
                uptime_seconds: Math.floor(process.uptime()),
            },
            laravel: laravelHealth,
            cache: {
                enabled: process.env.CACHE_ENABLED === 'true',
            },
        },
    });
});

module.exports = router;
