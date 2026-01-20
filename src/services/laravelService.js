/**
 * Laravel Backend Service
 *
 * Handles communication with the Laravel main backend.
 * Manages authentication token passthrough and request forwarding.
 */

const axios = require('axios');
const logger = require('../utils/logger');

class LaravelService {
    constructor() {
        this.baseUrl = process.env.LARAVEL_BACKEND_URL || 'http://localhost:8000';
        this.timeout = parseInt(process.env.LARAVEL_API_TIMEOUT) || 30000;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                logger.debug(`Laravel request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error(`Laravel request error: ${error.message}`);
                return Promise.reject(error);
            }
        );

        // Response interceptor for logging
        this.client.interceptors.response.use(
            (response) => {
                logger.debug(`Laravel response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'unknown';
                logger.error(`Laravel response error: ${status} - ${error.message}`);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Make authenticated request to Laravel
     *
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request data
     * @param {string} authToken - Bearer token
     * @returns {Promise<object>} Response data
     */
    async request(method, endpoint, data = null, authToken = null) {
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
            if (error.response) {
                // Laravel returned an error response
                const laravelError = {
                    status: error.response.status,
                    data: error.response.data,
                    message: error.response.data?.message || error.message,
                };
                throw laravelError;
            }
            throw error;
        }
    }

    /**
     * Get QR code preview from Laravel v2 API
     *
     * @param {object} previewData - Preview request data
     * @param {string} authToken - Optional auth token
     * @returns {Promise<object>} Preview response
     */
    async getPreview(previewData, authToken = null) {
        return this.request('POST', '/api/flutter/v2/preview', previewData, authToken);
    }

    /**
     * Get QR code preview SVG from Laravel Flutter endpoint
     *
     * This endpoint returns SVG when format='svg' or 'both'.
     * Response format varies - this method normalizes the response.
     *
     * @param {object} previewData - Preview request data
     * @param {string} authToken - Optional auth token
     * @returns {Promise<object>} Normalized response with SVG content
     */
    async getPreviewSvg(previewData, authToken = null) {
        // Ensure we request SVG format
        const data = {
            ...previewData,
            output_format: 'svg',
            format: 'svg',
        };

        logger.debug(`Requesting SVG from Laravel: ${JSON.stringify(data)}`);

        const response = await this.request('POST', '/api/flutter/preview', data, authToken);

        console.log('\n🔍 RAW LARAVEL RESPONSE:');
        console.log('Type:', typeof response);
        console.log('Keys:', Object.keys(response).join(', '));
        console.log('Full response:', JSON.stringify(response, null, 2).substring(0, 500));
        console.log('====\n');

        // Normalize the response to ensure SVG is accessible
        const normalized = {
            success: response.success,
            data: this.extractSvgFromResponse(response),
            raw: response,
        };

        logger.debug(`Laravel SVG response normalized: success=${normalized.success}, hasSvg=${!!normalized.data?.svg}`);

        return normalized;
    }

    /**
     * Extract SVG content from various Laravel response formats
     *
     * Laravel might return SVG in different ways:
     * - response.data.svg
     * - response.data.images.svg
     * - response.preview (string - the SVG directly!)
     * - response.preview.svg
     * - response.svg (direct)
     *
     * @param {object} response - Laravel API response
     * @returns {object} Normalized data object with svg property
     */
    extractSvgFromResponse(response) {
        console.log('\n🔍 === EXTRACTION DEBUG ===');
        console.log('Response keys:', Object.keys(response));
        console.log('Has preview?:', !!response.preview);
        console.log('Preview type:', typeof response.preview);
        if (response.preview) {
            console.log('Preview keys:', Object.keys(response.preview));
            console.log('Has preview.svg?:', !!response.preview.svg);
            if (response.preview.svg) {
                console.log('preview.svg length:', response.preview.svg.length);
            }
        }
        console.log('=========================\n');

        logger.debug('===extractSvgFromResponse called===');
        logger.debug('Response type:', typeof response);
        logger.debug('Response keys:', Object.keys(response).join(', '));

        let svg = null;

        // Try different paths where SVG might be
        if (response.data?.svg) {
            console.log('✅ FOUND: response.data.svg');
            svg = response.data.svg;
        } else if (response.data?.images?.svg) {
            logger.debug('✅ SVG found at response.data.images.svg');
            svg = response.data.images.svg;
        } else if (response.data?.images?.svg_base64) {
            logger.debug('✅ SVG found at response.data.images.svg_base64 (base64)');
            svg = Buffer.from(response.data.images.svg_base64, 'base64').toString('utf-8');
        }
        // CHECK IF PREVIEW IS THE SVG STRING DIRECTLY
        else if (typeof response.preview === 'string' && response.preview.includes('<svg')) {
            logger.debug('✅ SVG found as string in response.preview');
            svg = response.preview;
        }
        // THIS IS THE KEY CHECK FOR LARAVEL!
        else if (response.preview?.svg) {
            logger.info('✅✅✅ SVG FOUND at response.preview.svg ✅✅✅');
            logger.debug('SVG length:', response.preview.svg.length);
            svg = response.preview.svg;
        } else if (response.preview?.images?.svg) {
            logger.debug('✅ SVG found at response.preview.images.svg');
            svg = response.preview.images.svg;
        } else if (response.preview?.images?.svg_base64) {
            logger.debug('✅ SVG found at response.preview.images.svg_base64 (base64)');
            svg = Buffer.from(response.preview.images.svg_base64, 'base64').toString('utf-8');
        } else if (response.svg) {
            logger.debug('✅ SVG found at response.svg');
            svg = response.svg;
        } else if (response.images?.svg) {
            logger.debug('✅ SVG found at response.images.svg');
            svg = response.images.svg;
        } else if (response.images?.svg_base64) {
            logger.debug('✅ SVG found at response.images.svg_base64 (base64)');
            svg = Buffer.from(response.images.svg_base64, 'base64').toString('utf-8');
        }

        //  Debug what we're checking
        if (!svg) {
            logger.error('❌ NO SVG FOUND IN RESPONSE');
            logger.error('  response.preview exists?', !!response.preview);
            logger.error('  response.preview type:', typeof response.preview);
            if (response.preview && typeof response.preview === 'object') {
                logger.error('  response.preview.svg exists?', !!response.preview.svg);
                logger.error('  response.preview keys:', Object.keys(response.preview).join(', '));
            }
        }

        // If SVG is base64 encoded (starts with PD94 which is <?x in base64)
        if (svg && svg.startsWith('PD94')) {
            logger.debug('SVG is base64 encoded, decoding...');
            svg = Buffer.from(svg, 'base64').toString('utf-8');
        }

        if (!svg) {
            logger.warn('No SVG found in Laravel response. Response keys: ' + Object.keys(response).join(', '));
            if (response.preview) {
                logger.warn('Preview type: ' + typeof response.preview);
                logger.warn('Preview preview (first 100 chars): ' + String(response.preview).substring(0, 100));
            }
        }

        return {
            svg,
            images: {
                svg,
                svg_base64: svg ? Buffer.from(svg).toString('base64') : null,
            },
            meta: response.meta || response.data?.meta || {},
        };
    }

    /**
     * Get QR code SVG from Laravel
     *
     * @param {number} id - QR code ID
     * @param {string} authToken - Auth token
     * @returns {Promise<string>} SVG content
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
     * Get QR code details from Laravel
     *
     * @param {number} id - QR code ID
     * @param {string} authToken - Auth token
     * @returns {Promise<object>} QR code data
     */
    async getQRCode(id, authToken) {
        return this.request('GET', `/api/flutter/v2/qrcodes/${id}`, null, authToken);
    }

    /**
     * Get rendering capabilities from Laravel
     *
     * @returns {Promise<object>} Capabilities
     */
    async getCapabilities() {
        return this.request('GET', '/api/flutter/v2/capabilities');
    }

    /**
     * Proxy any request to Laravel
     *
     * @param {object} req - Express request object
     * @returns {Promise<object>} Laravel response
     */
    async proxyRequest(req) {
        const endpoint = req.path.replace(/^\/api\/proxy/, '');
        const authToken = req.headers['authorization'];

        const config = {
            method: req.method,
            url: endpoint,
            headers: {},
        };

        if (authToken) {
            config.headers['Authorization'] = authToken;
        }

        if (req.body && Object.keys(req.body).length > 0) {
            config.data = req.body;
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
     * Health check
     */
    async healthCheck() {
        try {
            await this.client.get('/api/flutter/v2/health');
            return { healthy: true };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
            };
        }
    }
}

module.exports = new LaravelService();
