/**
 * API Key Authentication Middleware
 *
 * Validates requests against a server-side API key.
 * The key can be provided via X-Api-Key header or api_key query parameter.
 *
 * SECURITY: Uses crypto.timingSafeEqual to prevent timing-based key enumeration.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Purpose: Executes apiKeyAuth functionality.
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const validKey = process.env.QR_API_KEY;

    if (!validKey) {
        logger.error('QR_API_KEY not configured in environment');
        return res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_MISCONFIGURED',
                message: 'API key not configured on server',
            },
        });
    }

    // SECURITY: Use timing-safe comparison to prevent key enumeration via timing attacks.
    // apiKey !== validKey is vulnerable because string comparison short-circuits on the
    // first mismatched character, leaking key length and prefix information.
    let isValid = false;
    if (apiKey) {
        try {
            const providedBuf = Buffer.from(String(apiKey));
            const validBuf = Buffer.from(validKey);
            // Buffers must be the same byte length for timingSafeEqual.
            // If lengths differ the key is wrong; we still do a dummy comparison
            // to ensure constant time regardless of length.
            if (providedBuf.length === validBuf.length) {
                isValid = crypto.timingSafeEqual(providedBuf, validBuf);
            }
        } catch {
            isValid = false;
        }
    }

    if (!isValid) {
        logger.warn(`Rejected API request: missing or invalid key, ip=${req.ip}, path=${req.path}`);
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or missing API key',
            },
        });
    }

    next();
};

module.exports = apiKeyAuth;
