/**
 * QR V2 Routes - New API routes for full QR code generation
 *
 * Base path: /api/v2/qr
 *
 * These routes use the new QRCodeGenerator which handles all QR styling
 * without depending on Laravel for image generation.
 */
const express = require('express');
const router = express.Router();
const qrV2Controller = require('../controllers/qrV2Controller');

/**
 * POST /api/v2/qr/generate
 *
 * Generate a full QR code with all styling options.
 *
 * Request Body:
 * {
 *   "type": "url",          // Required: QR code type
 *   "data": {               // Required: Type-specific data
 *     "url": "https://example.com"
 *   },
 *   "design": {             // Optional: Design configuration
 *     "foregroundColor": "#000000",
 *     "backgroundColor": "#FFFFFF",
 *     "fillType": "solid",  // "solid" or "gradient"
 *     "gradientFill": {     // Required if fillType is "gradient"
 *       "type": "LINEAR",   // "LINEAR" or "RADIAL"
 *       "angle": 45,
 *       "colors": [
 *         { "color": "#FF0000", "stop": 0 },
 *         { "color": "#0000FF", "stop": 100 }
 *       ]
 *     },
 *     "eyeInternalColor": "#000000",
 *     "eyeExternalColor": "#000000",
 *     "errorCorrection": "M",
 *     "margin": 4
 *   },
 *   "options": {            // Optional: Output options
 *     "size": 512,          // Image size (64-2048)
 *     "format": "both",     // "svg", "png", or "both"
 *     "quality": 90,        // PNG quality (1-100)
 *     "transparent": false  // Transparent PNG background
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "images": {
 *       "svg": "<svg>...</svg>",
 *       "svgBase64": "PHN2Zy...",
 *       "pngBase64": "iVBORw0KGgo..."
 *     },
 *     "meta": {
 *       "type": "url",
 *       "size": 512,
 *       "generationMs": 45,
 *       "moduleCount": 25,
 *       "errorCorrection": "M",
 *       "cached": false,
 *       "totalMs": 50
 *     }
 *   }
 * }
 */
router.post('/generate', qrV2Controller.generate);

/**
 * POST /api/v2/qr/preview
 *
 * Generate a quick preview (optimized for speed).
 * Uses smaller default size (256px) and returns only PNG.
 *
 * Request Body: Same as /generate
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "images": {
 *       "pngBase64": "iVBORw0KGgo..."
 *     },
 *     "meta": {
 *       "type": "url",
 *       "size": 256,
 *       "preview": true,
 *       "generationMs": 25,
 *       "cached": false,
 *       "totalMs": 28
 *     }
 *   }
 * }
 */
router.post('/preview', qrV2Controller.preview);

/**
 * GET /api/v2/qr/capabilities
 *
 * Get the capabilities and supported features of this QR generator.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "version": "2.0.0",
 *     "types": ["url", "text", "email", ...],
 *     "features": {
 *       "colors": { ... },
 *       "modules": { ... },
 *       "finders": { ... },
 *       "logo": { ... },
 *       "advancedShapes": { ... },
 *       "output": { ... },
 *       "errorCorrection": ["L", "M", "Q", "H"]
 *     }
 *   }
 * }
 */
router.get('/capabilities', qrV2Controller.getCapabilities);

/**
 * POST /api/v2/qr/validate
 *
 * Validate design configuration before generation.
 * Useful for providing immediate feedback in UI.
 *
 * Request Body:
 * {
 *   "type": "url",
 *   "data": { "url": "https://example.com" },
 *   "design": { ... }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "valid": true,
 *     "errors": [],
 *     "warnings": [
 *       {
 *         "field": "design",
 *         "message": "Some features are not yet implemented",
 *         "features": [
 *           { "feature": "module shapes", "status": "Phase 2" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
router.post('/validate', qrV2Controller.validateDesign);

/**
 * POST /api/v2/qr/batch
 *
 * Generate multiple QR codes in a single request.
 * Maximum 50 items per batch.
 *
 * Request Body:
 * {
 *   "items": [
 *     { "type": "url", "data": { "url": "https://a.com" } },
 *     { "type": "text", "data": { "text": "Hello" } }
 *   ],
 *   "options": {
 *     "stopOnError": false  // Continue even if one fails
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       { "index": 0, "success": true, "data": { ... } },
 *       { "index": 1, "success": true, "data": { ... } }
 *     ],
 *     "summary": {
 *       "total": 2,
 *       "success": 2,
 *       "errors": 0,
 *       "totalMs": 150
 *     }
 *   }
 * }
 */
router.post('/batch', qrV2Controller.batch);

module.exports = router;
