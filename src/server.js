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
// SECURITY: Restrict CORS to known origins (configure via ALLOWED_ORIGINS env var)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
    origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*'
        ? true  // Allow all in dev (set ALLOWED_ORIGINS in production)
        : allowedOrigins,
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
app.use(express.urlencoded({ extended: true }));

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
    const errorMsg = 'Route ' + req.method + ' ' + req.originalUrl + ' not found';
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: errorMsg,
        },
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Error: ' + err.message, { stack: err.stack });
    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'An internal error occurred'
                : err.message,
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
