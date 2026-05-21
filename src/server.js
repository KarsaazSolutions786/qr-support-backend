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
// compression reduces large JSON/base64 responses by ~60-70%.
// Install: npm install compression
const compression = require('compression');
const logger = require('./utils/logger');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Gzip compression — must be registered before routes so all responses are compressed.
// level 6 balances CPU cost vs compression ratio; threshold 1024 skips tiny payloads.
app.use(compression({ level: 6, threshold: 1024 }));

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

// ─── Global error handlers — prevent crashes from unhandled async rejections ──
// Must be registered before the server starts so they catch errors during boot.
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — process will exit: ' + err.message, { stack: err.stack });
    // Allow time for the logger to flush before exiting.
    // PM2 will restart the process automatically.
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error('Unhandled promise rejection: ' + message, { reason });
    // Do NOT exit here — unhandled rejections inside request handlers should
    // be caught by Express; only truly orphaned promises reach this handler.
    // Log and continue so a single bad request cannot bring down the server.
});

/**
 * Verify that Redis is reachable before the server accepts traffic.
 * Returns true on success, false on failure (non-fatal — server still starts).
 */
async function checkRedisConnection() {
    try {
        // redis or ioredis client — check common patterns used in the codebase
        const redisClient =
            require('./utils/redis').client ||
            require('./utils/redis').default ||
            require('./utils/redis');

        if (typeof redisClient.ping === 'function') {
            await redisClient.ping();
            logger.info('Redis startup health check passed');
            return true;
        }
        // No ping method — Redis client shape is unknown; skip check
        logger.warn('Redis client found but has no ping() method — skipping startup check');
        return true;
    } catch (err) {
        // Ignore module-not-found errors — Redis may be optional for this service
        if (err.code === 'MODULE_NOT_FOUND') {
            logger.info('No Redis client module detected — skipping Redis startup check');
            return true;
        }
        logger.warn('Redis startup health check failed: ' + err.message + ' — continuing without Redis');
        return false;
    }
}

// Start server — skip when required from Jest so supertest can bind its own port
if (require.main === module) {
    const server = app.listen(PORT, async () => {
        logger.info('QR Support Backend running on port ' + PORT);
        logger.info('Laravel backend: ' + (process.env.LARAVEL_BACKEND_URL || 'http://localhost:8000'));
        logger.info('V2 API available at /api/v2/qr/*');

        // Startup health check: Redis connectivity
        await checkRedisConnection();

        // Warm up the connection pool to Laravel so the first real request does
        // not pay full TCP + TLS handshake cost. Failures are non-fatal.
        try {
            const laravelService = require('./services/laravelService');
            const result = await laravelService.healthCheck();
            if (result.healthy) {
                logger.info('Laravel connection pool warmed up successfully');
            } else {
                logger.warn('Laravel warm-up returned unhealthy: ' + (result.error || result.code || 'unknown'));
            }
        } catch (err) {
            logger.warn('Laravel connection pool warm-up failed (Laravel may not be running): ' + err.message);
        }
    });

    // Handle EADDRINUSE so the error message is clear in PM2 logs
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(
                'Port ' + PORT + ' is already in use. ' +
                'Stop the conflicting process or change the PORT env variable.'
            );
            process.exit(1);
        }
        logger.error('Server error: ' + err.message, { stack: err.stack });
        process.exit(1);
    });
}

module.exports = app;
