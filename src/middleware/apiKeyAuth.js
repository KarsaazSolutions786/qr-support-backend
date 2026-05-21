/**
 * API Key Authentication Middleware
 *
 * Validates requests against a server-side API key.
 * The key can be provided via X-Api-Key header or api_key query parameter.
 */

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

    if (!apiKey || apiKey !== validKey) {
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
