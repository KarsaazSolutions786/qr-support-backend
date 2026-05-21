/**
 * JSON-RPC 2.0 Controller for QR Support Backend
 *
 * Single endpoint: POST /api/rpc
 * Supports single + batch requests, deduplication, and per-method error isolation.
 *
 * Methods:
 *   qr.preview   — Proxy to Laravel for QR preview (SVG → PNG)
 *   qr.render     — Direct SVG → PNG conversion
 *   qr.capabilities — List supported QR capabilities
 */

const laravelService = require('../services/laravelService');
const svgToPngService = require('../services/svgToPngService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// ─── JSON-RPC 2.0 Error Codes ──────────────────────────────────────────────

const RPC_ERRORS = {
    PARSE_ERROR:      { code: -32700, message: 'Parse error' },
    INVALID_REQUEST:  { code: -32600, message: 'Invalid Request' },
    METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
    INVALID_PARAMS:   { code: -32602, message: 'Invalid params' },
    INTERNAL_ERROR:   { code: -32603, message: 'Internal error' },
};

// ─── RPC Method Registry ────────────────────────────────────────────────────

const methods = {
    'qr.preview': handleQrPreview,
    'qr.render': handleQrRender,
    'qr.capabilities': handleQrCapabilities,
};

// ─── Method Handlers ────────────────────────────────────────────────────────

/**
 * Purpose: qr.preview — Proxy to Laravel, get SVG, convert to PNG Params: { qrcode_id, type, ...designParams }
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */

async function handleQrPreview(params) {
    const { qrcode_id, type, size = 512, quality = 90, ...designParams } = params || {};

    if (!qrcode_id && !type) {
        const err = new Error(RPC_ERRORS.INVALID_PARAMS.message);
        err.code = RPC_ERRORS.INVALID_PARAMS.code;
        err.data = 'qrcode_id or type is required';
        throw err;
    }

    // Proxy to Laravel for full-featured SVG generation
    const svgResponse = await laravelService.generatePreview({
        qrcode_id,
        type,
        ...designParams,
    });

    if (!svgResponse || !svgResponse.svg) {
        const err = new Error(RPC_ERRORS.INTERNAL_ERROR.message);
        err.code = RPC_ERRORS.INTERNAL_ERROR.code;
        err.data = 'Laravel returned no SVG';
        throw err;
    }

    // Convert SVG → PNG
    const pngResult = await svgToPngService.convert(svgResponse.svg, {
        width: parseInt(size) || 512,
        height: parseInt(size) || 512,
        quality: parseInt(quality) || 90,
        transparent: false,
    });

    return {
        png_base64: pngResult.base64 || pngResult.toString('base64'),
        size: parseInt(size) || 512,
        format: 'png',
    };
}

/**
 * Purpose: qr.render — Direct SVG to PNG conversion (no Laravel proxy) Params: { svg, size?, quality?, format? }
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */

async function handleQrRender(params) {
    const { svg, size = 512, quality = 90, format = 'base64' } = params || {};

    if (!svg || typeof svg !== 'string') {
        const err = new Error(RPC_ERRORS.INVALID_PARAMS.message);
        err.code = RPC_ERRORS.INVALID_PARAMS.code;
        err.data = 'svg string is required';
        throw err;
    }

    // Check cache
    const cacheKey = `rpc:render:${Buffer.from(svg).toString('base64').slice(0, 64)}:${size}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    const pngResult = await svgToPngService.convert(svg, {
        width: parseInt(size) || 512,
        height: parseInt(size) || 512,
        quality: parseInt(quality) || 90,
    });

    const result = {
        png_base64: pngResult.base64 || pngResult.toString('base64'),
        size: parseInt(size),
        format: 'png',
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, JSON.stringify(result), 300);

    return result;
}

/**
 * Purpose: qr.capabilities — Return supported QR generation capabilities
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */

async function handleQrCapabilities() {
    return {
        version: '3.0.0',
        architecture: 'laravel_proxy',
        svg_to_png: true,
        laravel_proxy: true,
        max_size: parseInt(process.env.MAX_PNG_SIZE) || 2048,
        supported_formats: ['png'],
        batch_support: true,
    };
}

// ─── Core RPC Dispatcher ────────────────────────────────────────────────────

/**
 * Purpose: Executes makeError functionality.
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */
function makeError(code, message, data, id = null) {
    const err = { code, message };
    if (data !== undefined) err.data = data;
    return { jsonrpc: '2.0', error: err, id };
}

/**
 * Purpose: Executes makeSuccess functionality.
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */
function makeSuccess(result, id) {
    return { jsonrpc: '2.0', result, id };
}

/**
 * Purpose: Executes dispatchSingle functionality.
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */
async function dispatchSingle(request) {
    // Validate JSON-RPC 2.0 structure
    if (!request || typeof request !== 'object') {
        return makeError(-32600, 'Invalid Request', undefined, null);
    }

    const { jsonrpc, method, params, id } = request;

    if (jsonrpc !== '2.0') {
        return makeError(-32600, 'Invalid Request: jsonrpc must be "2.0"', undefined, id || null);
    }

    if (!method || typeof method !== 'string') {
        return makeError(-32600, 'Invalid Request: method is required', undefined, id || null);
    }

    // Notifications (no id) are not supported
    if (id === undefined || id === null) {
        return makeError(-32600, 'Notifications not supported', undefined, null);
    }

    // Resolve method handler
    const handler = methods[method];
    if (!handler) {
        return makeError(-32601, `Method not found: ${method}`, undefined, id);
    }

    // Execute
    try {
        const result = await handler(params || {});
        return makeSuccess(result, id);
    } catch (err) {
        if (err && err.code && err.message) {
            // Structured RPC error
            return makeError(err.code, err.message, err.data, id);
        }
        logger.error(`RPC method ${method} failed:`, err);
        return makeError(-32603, 'Internal error', undefined, id);
    }
}

// ─── Express Handler ────────────────────────────────────────────────────────

/**
 * POST /api/rpc
 * Accepts single or batch JSON-RPC 2.0 requests
 */
exports.handle = async (req, res) => {
    const startTime = Date.now();

    // Parse body
    const body = req.body;
    if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
        return res.status(200).json(
            makeError(-32700, 'Parse error', undefined, null)
        );
    }

    // Batch request
    if (Array.isArray(body)) {
        if (body.length === 0) {
            return res.status(200).json(
                makeError(-32600, 'Invalid Request: empty batch', undefined, null)
            );
        }

        const MAX_BATCH = parseInt(process.env.RPC_MAX_BATCH) || 20;
        if (body.length > MAX_BATCH) {
            return res.status(200).json(
                makeError(-32600, `Batch too large (max ${MAX_BATCH})`, undefined, null)
            );
        }

        // Dedup: same method+params → execute once
        const dedupMap = new Map();
        const dedupKeys = [];

        for (const req of body) {
            const key = `${req.method}:${JSON.stringify(req.params || {})}`;
            dedupKeys.push(key);
            if (!dedupMap.has(key)) {
                dedupMap.set(key, dispatchSingle(req));
            }
        }

        // Wait for all unique executions
        const keyArray = [...dedupMap.keys()];
        const resultArray = await Promise.all(keyArray.map(k => dedupMap.get(k)));
        const resultMap = new Map(keyArray.map((k, i) => [k, resultArray[i]]));

        // Map back to original order, adjusting IDs for deduped calls
        const responses = body.map((req, i) => {
            const result = resultMap.get(dedupKeys[i]);
            return { ...result, id: req.id };
        });

        logger.info(`RPC batch: ${body.length} calls (${dedupMap.size} unique) in ${Date.now() - startTime}ms`);
        return res.status(200).json(responses);
    }

    // Single request
    const response = await dispatchSingle(body);
    logger.info(`RPC: ${body.method || 'unknown'} in ${Date.now() - startTime}ms`);
    return res.status(200).json(response);
};

/**
 * GET /api/rpc/methods
 * Discovery endpoint — lists available RPC methods
 */
exports.methods = (req, res) => {
    res.json({
        jsonrpc: '2.0',
        result: {
            methods: Object.keys(methods).map(name => ({
                name,
                description: getMethodDescription(name),
            })),
        },
        id: null,
    });
};

/**
 * Purpose: Retrieves methoddescription.
 * Owner/Author: Syed Ashhad
 * Created/Updated: March 2026
 */
function getMethodDescription(name) {
    const descriptions = {
        'qr.preview': 'Generate QR code preview via Laravel proxy (SVG → PNG)',
        'qr.render': 'Convert raw SVG to PNG directly',
        'qr.capabilities': 'List supported QR generation capabilities',
    };
    return descriptions[name] || '';
}
