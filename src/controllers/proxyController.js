/**
 * Proxy Controller
 *
 * Forwards requests to Laravel backend with optional processing.
 * Useful for endpoints that don't need SVG-to-PNG conversion.
 */

const laravelService = require('../services/laravelService');
const logger = require('../utils/logger');

/**
 * Proxy any request to Laravel backend
 *
 * ALL /api/proxy/*
 *
 * Passes through:
 * - Authorization header
 * - Request body
 * - Query parameters
 */
exports.proxyRequest = async (req, res) => {
    const startTime = Date.now();

    try {
        const result = await laravelService.proxyRequest(req);
        const duration = Date.now() - startTime;

        // Set any relevant headers from Laravel response
        if (result.headers) {
            const forwardHeaders = ['content-type', 'cache-control', 'x-ratelimit-remaining'];
            forwardHeaders.forEach(header => {
                if (result.headers[header]) {
                    res.set(header, result.headers[header]);
                }
            });
        }

        res.set('X-Proxy-Time', `${duration}ms`);
        res.status(result.status).json(result.data);
    } catch (error) {
        logger.error(`Proxy request failed: ${error.message}`);

        // Forward Laravel error response if available
        if (error.status && error.data) {
            return res.status(error.status).json(error.data);
        }

        res.status(502).json({
            success: false,
            error: {
                code: 'PROXY_FAILED',
                message: 'Failed to proxy request to backend',
            },
        });
    }
};
