/**
 * Proxy Controller
 *
 * Forwards requests to Laravel backend with optional processing.
 * Useful for endpoints that don't need SVG-to-PNG conversion.
 *
 * SECURITY: Only proxies to the configured LARAVEL_BACKEND_URL.
 * Validates that proxy paths don't contain URL manipulation attempts.
 */

const laravelService = require('../services/laravelService');
const logger = require('../utils/logger');

// SECURITY: Allow-list of permitted proxy path prefixes
// Only these Laravel API paths can be proxied
const ALLOWED_PROXY_PREFIXES = [
    '/api/',
];

// SECURITY: Block-list of sensitive paths that must never be proxied
const BLOCKED_PROXY_PATHS = [
    '/install',
    '/system/log',
    '/debug/',
    '/speed-test',
    '/benchmark',
    '/telescope',
    '/horizon',
];

/**
 * Validate that the proxy target path is safe
 */
function isProxyPathAllowed(path) {
    // Normalize path
    const normalizedPath = decodeURIComponent(path).replace(/\\/g, '/').toLowerCase();

    // Block path traversal attempts
    if (normalizedPath.includes('..') || normalizedPath.includes('//')) {
        return false;
    }

    // Block absolute URLs (SSRF via URL in path)
    if (normalizedPath.includes('://') || normalizedPath.startsWith('//')) {
        return false;
    }

    // Check against blocked paths
    for (const blocked of BLOCKED_PROXY_PATHS) {
        if (normalizedPath.includes(blocked)) {
            return false;
        }
    }

    // Must start with an allowed prefix
    const hasAllowedPrefix = ALLOWED_PROXY_PREFIXES.some(prefix =>
        normalizedPath.startsWith(prefix)
    );

    return hasAllowedPrefix;
}

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
        // SECURITY: Validate proxy target path
        const targetPath = req.path.replace(/^\/api\/proxy/, '');
        if (!isProxyPathAllowed(targetPath)) {
            logger.warn(`Blocked proxy request to disallowed path: ${targetPath}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'PROXY_FORBIDDEN',
                    message: 'Proxy request to this path is not allowed',
                },
            });
        }

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
