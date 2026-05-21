/**
 * Laravel Backend Service (Refactored)
 *
 * Handles ALL communication with the Laravel main backend.
 * This is the ONLY way Flutter QR codes are generated - ensuring feature parity with web.
 * 
 * Key improvements:
 * - Always normalizes parameters (camelCase → snake_case)
 * - Better SVG extraction with multiple fallback paths
 * - Improved error handling and logging
 * - Retry logic for transient failures
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const logger = require('../utils/logger');
const { normalizeRequestForLaravel, normalizeDesignForLaravel } = require('../utils/parameterNormalizer');

// HTTP agents with Keep-Alive for connection reuse (major performance boost)
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 10,
    maxFreeSockets: 5,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 10,
    maxFreeSockets: 5,
});

/**
 * Purpose: Class definition for LaravelService.
 * Owner/Author: Syed Ashhad
 * Created/Updated: January 2026
 */
class LaravelService {
    /**
     * Purpose: Constructor for constructor.
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    constructor() {
        this.baseUrl = process.env.LARAVEL_BACKEND_URL || 'http://localhost:8000';
        this.timeout = parseInt(process.env.LARAVEL_API_TIMEOUT) || 60000;
        this.maxRetries = parseInt(process.env.LARAVEL_MAX_RETRIES) || 2;
        this._rpcId = 0;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Connection': 'keep-alive',
            },
            // Use keep-alive agents for connection pooling
            httpAgent: httpAgent,
            httpsAgent: httpsAgent,
        });

        // Request interceptor - only log in debug mode to reduce overhead
        this.client.interceptors.request.use(
            (config) => {
                logger.debug(`→ Laravel: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error(`Laravel request error: ${error.message}`);
                return Promise.reject(error);
            }
        );

        // Response interceptor - only log errors at info level
        this.client.interceptors.response.use(
            (response) => {
                logger.debug(`← Laravel: ${response.status}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'unknown';
                const message = error.response?.data?.error?.message || error.message;
                logger.error(`← Laravel error: ${status} - ${message}`);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Purpose: Make authenticated request to Laravel with retry logic
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async request(method, endpoint, data = null, authToken = null, retryCount = 0) {
        const config = {
            method,
            url: endpoint,
            headers: {},
        };

        if (authToken) {
            config.headers['Authorization'] = authToken.startsWith('Bearer ')
                ? authToken
                : `Bearer ${authToken}`;
        }

        if (data) {
            if (method.toLowerCase() === 'get') {
                config.params = data;
            } else {
                config.data = data;
            }
        }

        try {
            const response = await this.client.request(config);
            return response.data;
        } catch (error) {
            // Retry on timeout or 5xx errors
            if (retryCount < this.maxRetries) {
                const isRetryable = error.code === 'ECONNABORTED' ||
                    error.code === 'ETIMEDOUT' ||
                    (error.response?.status >= 500 && error.response?.status < 600);

                if (isRetryable) {
                    logger.warn(`Retrying Laravel request (attempt ${retryCount + 1}/${this.maxRetries}): ${endpoint}`);
                    await this.delay(1000 * (retryCount + 1)); // Exponential backoff
                    return this.request(method, endpoint, data, authToken, retryCount + 1);
                }
            }

            if (error.response) {
                // Laravel returned an error response
                const laravelError = {
                    status: error.response.status,
                    data: error.response.data,
                    message: error.response.data?.message || error.response.data?.error?.message || error.message,
                };
                throw laravelError;
            }
            throw error;
        }
    }

    /**
     * Purpose: Delay helper for retry logic
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Purpose: Get QR code preview SVG from Laravel Flutter endpoint This is the PRIMARY method for generating QR codes for Flutter. Always normalizes parameters to ensure Laravel receives correct format.
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async getPreviewSvg(previewData, authToken = null) {
        // Normalize parameters for Laravel (camelCase → snake_case)
        const normalizedData = normalizeRequestForLaravel(previewData);
        normalizedData.output_format = 'svg';
        normalizedData.format = 'svg';

        try {
            const response = await this.request('POST', '/api/flutter/preview', normalizedData, authToken);

            const normalized = {
                success: response.success,
                data: this.extractSvgFromResponse(response),
                raw: response,
            };

            if (!normalized.data?.svg) {
                logger.error('Failed to extract SVG from Laravel response');
            }

            return normalized;
        } catch (error) {
            logger.error(`Laravel preview error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Purpose: Extract SVG content from various Laravel response formats Laravel might return SVG in different ways depending on the endpoint version. This method handles ALL known formats.
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    extractSvgFromResponse(response) {
        logger.debug('Extracting SVG from response...');

        let svg = null;

        // Method 1: response.preview.svg (primary format for /api/flutter/preview)
        if (response.preview?.svg) {
            logger.debug('✅ SVG found at response.preview.svg');
            svg = response.preview.svg;
        }
        // Method 2: response.preview is the SVG string directly
        else if (typeof response.preview === 'string' && response.preview.includes('<svg')) {
            logger.debug('✅ SVG found as string in response.preview');
            svg = response.preview;
        }
        // Method 3: response.data.svg
        else if (response.data?.svg) {
            logger.debug('✅ SVG found at response.data.svg');
            svg = response.data.svg;
        }
        // Method 4: response.data.images.svg
        else if (response.data?.images?.svg) {
            logger.debug('✅ SVG found at response.data.images.svg');
            svg = response.data.images.svg;
        }
        // Method 5: response.data.images.svg_base64 (base64 encoded)
        else if (response.data?.images?.svg_base64) {
            logger.debug('✅ SVG found at response.data.images.svg_base64 (base64)');
            svg = Buffer.from(response.data.images.svg_base64, 'base64').toString('utf-8');
        }
        // Method 6: response.svg (direct)
        else if (response.svg) {
            logger.debug('✅ SVG found at response.svg');
            svg = response.svg;
        }
        // Method 7: response.images.svg
        else if (response.images?.svg) {
            logger.debug('✅ SVG found at response.images.svg');
            svg = response.images.svg;
        }
        // Method 8: Check for preview.images.svg
        else if (response.preview?.images?.svg) {
            logger.debug('✅ SVG found at response.preview.images.svg');
            svg = response.preview.images.svg;
        }

        // Handle base64 encoded SVG (PD94=<?xml, PHN2=<svg, PD9=general XML)
        if (svg && (svg.startsWith('PD94') || svg.startsWith('PHN2') || svg.startsWith('PD9'))) {
            logger.debug('SVG is base64 encoded, decoding...');
            svg = Buffer.from(svg, 'base64').toString('utf-8');
        }

        if (!svg) {
            logger.error('❌ NO SVG FOUND IN RESPONSE');
            logger.error('Response structure:', JSON.stringify({
                hasPreview: !!response.preview,
                previewType: typeof response.preview,
                previewKeys: response.preview && typeof response.preview === 'object'
                    ? Object.keys(response.preview) : 'N/A',
                hasData: !!response.data,
                dataKeys: response.data ? Object.keys(response.data) : 'N/A',
                topLevelKeys: Object.keys(response),
            }));
        }

        return {
            svg,
            images: {
                svg,
                svg_base64: svg ? Buffer.from(svg).toString('base64') : null,
            },
            meta: response.meta || response.preview?.meta || response.data?.meta || {},
        };
    }

    /**
     * Purpose: Get QR code SVG from Laravel (for saved QR codes)
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async getQRCodeSvg(id, authToken) {
        const response = await this.client.get(`/api/flutter/qrcodes/${id}/svg`, {
            headers: {
                'Authorization': authToken.startsWith('Bearer ')
                    ? authToken
                    : `Bearer ${authToken}`,
            },
            responseType: 'text',
        });
        return response.data;
    }

    /**
     * Purpose: Get QR code details from Laravel
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async getQRCode(id, authToken) {
        return this.request('GET', `/api/flutter/v2/qrcodes/${id}`, null, authToken);
    }

    /**
     * Purpose: Get rendering capabilities from Laravel
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async getCapabilities() {
        return this.request('GET', '/api/flutter/v2/capabilities');
    }

    /**
     * Purpose: Proxy any request to Laravel
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async proxyRequest(req) {
        const endpoint = req.path.replace(/^\/api\/proxy/, '');
        const authToken = req.headers['authorization'];

        // Normalize design parameters if present in body
        let body = req.body;
        if (body?.design) {
            body = {
                ...body,
                design: normalizeDesignForLaravel(body.design),
            };
        }

        const config = {
            method: req.method,
            url: endpoint,
            headers: {},
        };

        if (authToken) {
            config.headers['Authorization'] = authToken;
        }

        if (body && Object.keys(body).length > 0) {
            config.data = body;
        }

        if (req.query && Object.keys(req.query).length > 0) {
            config.params = req.query;
        }

        const response = await this.client.request(config);
        return {
            status: response.status,
            data: response.data,
            headers: response.headers,
        };
    }

    /**
     * Purpose: Health check - verify Laravel is accessible
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    async healthCheck() {
        try {
            const response = await this.client.get('/api/health', { timeout: 5000 });
            return {
                healthy: true,
                status: response.data?.status || 'ok',
                latency_ms: response.headers['x-response-time'] || 'unknown',
            };
        } catch (error) {
            logger.error(`Laravel health check failed: ${error.message}`, { code: error.code });
            return {
                healthy: false,
                error: 'Laravel backend is unreachable.',
                code: error.code || 'CONNECTION_ERROR',
            };
        }
    }

    // ─── JSON-RPC 2.0 Transport ──────────────────────────────────────

    /**
     * Purpose: Call a single JSON-RPC 2.0 method on the Laravel backend.
     * Owner/Author: Syed Ashhad
     * Created/Updated: March 2026
     */
    
    async rpc(method, params = {}, authToken = null) {
        const endpoint = authToken ? '/api/rpc' : '/api/rpc/public';
        const id = ++this._rpcId;

        const body = {
            jsonrpc: '2.0',
            method,
            params,
            id,
        };

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = authToken.startsWith('Bearer ')
                ? authToken
                : `Bearer ${authToken}`;
        }

        logger.debug(`→ RPC: ${method} (id=${id})`);

        try {
            const response = await this.client.post(endpoint, body, { headers });
            const data = response.data;

            if (data.error) {
                const err = new Error(data.error.message || 'RPC error');
                err.code = data.error.code;
                err.data = data.error.data;
                err.rpcError = true;
                throw err;
            }

            return data.result;
        } catch (error) {
            if (error.rpcError) throw error;
            logger.error(`RPC error (${method}): ${error.message}`);
            throw error;
        }
    }

    /**
     * Purpose: Call multiple JSON-RPC 2.0 methods in a single HTTP request.
     * Owner/Author: Syed Ashhad
     * Created/Updated: March 2026
     */
    
    async rpcBatch(calls, authToken = null) {
        const endpoint = authToken ? '/api/rpc' : '/api/rpc/public';

        const requests = calls.map(call => ({
            jsonrpc: '2.0',
            method: call.method,
            params: call.params || {},
            id: ++this._rpcId,
        }));

        // Build id → method lookup
        const idToMethod = new Map();
        requests.forEach((req, i) => {
            idToMethod.set(req.id, calls[i].method);
        });

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = authToken.startsWith('Bearer ')
                ? authToken
                : `Bearer ${authToken}`;
        }

        logger.debug(`→ RPC Batch: ${calls.map(c => c.method).join(', ')}`);

        const response = await this.client.post(endpoint, requests, { headers });

        const resultMap = new Map();
        const responses = Array.isArray(response.data) ? response.data : [response.data];

        // Index by id
        const byId = new Map();
        for (const resp of responses) {
            if (resp && resp.id != null) byId.set(resp.id, resp);
        }

        for (const [id, method] of idToMethod) {
            const resp = byId.get(id);
            if (!resp) {
                resultMap.set(method, { error: { code: -32603, message: 'No response' }, result: null });
            } else if (resp.error) {
                resultMap.set(method, { error: resp.error, result: null });
            } else {
                resultMap.set(method, { error: null, result: resp.result });
            }
        }

        return resultMap;
    }
}

module.exports = new LaravelService();
