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
     * Response format: { success: true, preview: { svg: "..." }, meta: {...} }
     *
     * @param {object} previewData - Preview request data
     * @param {string} authToken - Optional auth token
     * @returns {Promise<object>} Preview response with SVG
     */
    async getPreviewSvg(previewData, authToken = null) {
        // Ensure we request SVG format
        const data = {
            ...previewData,
            output_format: 'svg',
        };
        return this.request('POST', '/api/flutter/preview', data, authToken);
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
