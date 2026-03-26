/**
 * QR Support Backend - Main Server
 *
 * Node.js middleware that sits between Flutter app and Laravel backend.
 * Handles SVG-to-PNG conversion using Sharp for reliable image rendering.
 *
 * V2 API: Full QR generation without Laravel dependency
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// ─── CORS Configuration ─────────────────────────────────────────────────────
// Origins are controlled by the ALLOWED_ORIGINS env var (comma-separated).
//
// How to add a new origin:
//   1. Open your .env (or hosting panel env vars).
//   2. Append the full origin URL to ALLOWED_ORIGINS, comma-separated.
//      Example: ALLOWED_ORIGINS=https://app.karsaazqr.com,https://new-app.example.com
//   3. Restart the server.
//
// Behaviour when ALLOWED_ORIGINS is empty / not set:
//   - Production: ALL cross-origin requests are rejected (secure default).
//   - Development (APP_ENV=development OR NODE_ENV=development):
//     localhost origins (http://localhost:*) are automatically allowed.
// ─────────────────────────────────────────────────────────────────────────────
const isDev = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'development';

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

app.use(cors({
    origin: function (origin, callback) {
        // Allow server-to-server requests (no origin header)
        if (!origin) return callback(null, true);

        // Check explicit allow-list
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // In development, permit any localhost origin
        if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        // Reject everything else
        callback(new Error('CORS: origin ' + origin + ' is not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later.',
        },
    },
});
app.use('/api/', limiter);

// Body parsing - SECURITY: Limit payload size to prevent DoS
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logMsg = req.method + ' ' + req.originalUrl + ' ' + res.statusCode + ' ' + duration + 'ms';
        logger.info(logMsg);
    });
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: {
            v1: 'Laravel-dependent QR generation',
            v2: 'Standalone QR generation (no Laravel dependency)',
        },
    });
});

// API routes (includes both V1 and V2)
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
    logger.warn('Route not found: ' + req.method + ' ' + req.originalUrl);
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'The requested resource was not found.',
        },
    });
});

// Error handler
// SECURITY: Never leak error details unless explicitly in development mode
app.use((err, req, res, next) => {
    logger.error('Error: ' + err.message, { stack: err.stack });
    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'development'
                ? err.message
                : 'An internal error occurred',
        },
    });
});

// Start server
app.listen(PORT, () => {
    logger.info('QR Support Backend running on port ' + PORT);
    logger.info('Laravel backend: ' + (process.env.LARAVEL_BACKEND_URL || 'http://localhost:8000'));
    logger.info('V2 API available at /api/v2/qr/*');
});

module.exports = app;
