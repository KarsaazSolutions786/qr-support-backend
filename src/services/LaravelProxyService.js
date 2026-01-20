const axios = require('axios');
const svgToPngService = require('./svgToPngService');

/**
 * Service to proxy themed shape requests to Laravel backend.
 * Laravel has 60+ themed shapes with complex SVG masking already implemented.
 */
class LaravelProxyService {
    constructor() {
        this.laravelBaseUrl = process.env.LARAVEL_BACKEND_URL || 'http://127.0.0.1:8000';
        this.apiPrefix = '/api/flutter/v2';
    }

    /**
     * Get list of all available themed shapes from Laravel
     * @returns {Promise<Object>} Themed shapes list
     */
    async getThemedShapes() {
        try {
            const response = await axios.get(`${this.laravelBaseUrl}${this.apiPrefix}/themed-shapes`, {
                timeout: 5000,
            });

            if (response.data && response.data.success) {
                return response.data.data;
            }

            throw new Error('Failed to fetch themed shapes from Laravel');
        } catch (error) {
            console.error('Laravel proxy error (themed-shapes):', error.message);
            throw new Error(`Laravel backend not available: ${error.message}`);
        }
    }

    /**
     * Generate QR code with themed shape via Laravel backend
     * 
     * Strategy:
     * 1. Send design to Laravel to generate complex SVG with shape masking
     * 2. Receive SVG string
     * 3. Convert SVG to PNG using Node.js (sharp) for high quality
     * 
     * This avoids dependency on Laravel's Imagick extension which might be missing.
     * 
     * @param {Object} design - Design configuration including themed_shape
     * @param {Object} data - QR code data (url, text, etc.)
     * @param {string} type - QR code type
     * @param {number} size - Output size in pixels
     * @returns {Promise<Buffer>} PNG buffer
     */
    async generateWithThemedShape(design, data, type, size = 512) {
        try {
            const payload = {
                type: type,
                data: data,
                design: this.convertDesignToLaravelFormat(design),
                // Request format 'svg' explicitly to trigger server rendering
                options: {
                    format: 'svg',
                    size: size
                }
            };

            console.log(`[LaravelProxy] Generating themed QR (SVG): ${design.themed_shape || design.shape}`);

            // 1. Get SVG from Laravel
            const response = await axios.post(
                `${this.laravelBaseUrl}${this.apiPrefix}/preview/svg`,
                payload,
                {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            const svgContent = response.data;

            if (!svgContent || typeof svgContent !== 'string') {
                throw new Error('Invalid SVG response from Laravel');
            }

            // 2. Convert to PNG using Node.js service
            // We use the same service as for other QRs for consistency
            const pngBuffer = await svgToPngService.convert(svgContent, {
                width: size,
                height: size,
                background: design.backgroundColor || '#FFFFFF',
                preprocessed: true // Skip preprocessing as Laravel SVGs are already valid and complex
            });

            return pngBuffer;

        } catch (error) {
            console.error('Laravel proxy error (generate):', error.message);
            if (error.response) {
                console.error('Laravel response status:', error.response.status);
                // Try to log minimal response data
                const logData = typeof error.response.data === 'string'
                    ? error.response.data.substring(0, 200)
                    : JSON.stringify(error.response.data || {}).substring(0, 200);
                console.error('Laravel response data:', logData);
            }
            throw new Error(`Failed to generate themed QR: ${error.message}`);
        }
    }

    /**
     * Convert Node.js design format to Laravel format
     * @param {Object} design - Node.js design object
     * @returns {Object} Laravel-compatible design object
     */
    convertDesignToLaravelFormat(design) {
        const laravelDesign = {
            // Map themed_shape to shape (Laravel uses 'shape')
            shape: design.themed_shape || design.shape,

            // Colors
            foregroundColor: design.foregroundColor || design.color || '#000000',
            backgroundColor: design.backgroundColor || design.bgColor || '#FFFFFF',

            // Eye colors (if different from foreground)
            eyeColor: design.eyeColor || design.foregroundColor || design.color,
            eyeBallColor: design.eyeBallColor || design.eyeColor,

            // Frame color for themed shapes
            frameColor: design.frameColor || design.foregroundColor || design.color || '#000000',

            // Module shape
            module: design.module || design.moduleShape || 'square',

            // Finder patterns
            finder: design.finder || design.finderShape || 'default',
            finderDot: design.finderDot || design.finderDotShape || 'default',
        };

        // Add gradient if present
        if (design.gradient || design.gradientFill) {
            laravelDesign.fillType = 'gradient';
            laravelDesign.gradientFill = design.gradient || design.gradientFill;
        }

        // Add logo if present
        if (design.logo || design.logoUrl) {
            laravelDesign.logoUrl = design.logo || design.logoUrl;
            if (design.logoSize) laravelDesign.logoSize = design.logoSize;
            if (design.logoMargin) laravelDesign.logoMargin = design.logoMargin;
        }

        return laravelDesign;
    }

    /**
     * Check if Laravel backend is available
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        try {
            const response = await axios.get(`${this.laravelBaseUrl}${this.apiPrefix}/health`, {
                timeout: 3000,
            });
            return response.data && response.data.success;
        } catch (error) {
            console.error('Laravel health check failed:', error.message);
            return false;
        }
    }

    /**
     * Determine if a design requires Laravel backend (has themed shape)
     * @param {Object} design
     * @returns {boolean}
     */
    requiresLaravelBackend(design) {
        return !!(design.themed_shape || design.shape);
    }
}

module.exports = new LaravelProxyService();
