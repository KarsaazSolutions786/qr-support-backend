/**
 * LogoProcessor - Handles logo embedding in QR codes
 *
 * Sort Order: 200 (runs after all other visual processors)
 *
 * Features:
 * - Load logo from URL or base64
 * - Position logo (center or custom X/Y)
 * - Scale logo relative to QR size
 * - Rotate logo
 * - Add background behind logo (circle, square, rounded)
 * - Supports PNG, JPG, SVG logos
 */
const BaseProcessor = require('./BaseProcessor');
const https = require('https');
const http = require('http');
const sharp = require('sharp');

class LogoProcessor extends BaseProcessor {
    constructor() {
        super('LogoProcessor', 200);

        // Supported background shapes
        this.backgroundShapes = {
            'circle': this.createCircleBackground.bind(this),
            'square': this.createSquareBackground.bind(this),
            'rounded': this.createRoundedBackground.bind(this),
            'none': null,
        };

        // Cache for loaded logos
        this.logoCache = new Map();
    }

    /**
     * Check if this processor should process the payload
     * @param {Object} payload
     * @returns {boolean}
     */
    shouldProcess(payload) {
        const { design } = payload;
        // Process if logo URL or logo data is provided
        return !!(design.logoUrl || design.logo || design.logoData || design.logoBase64);
    }

    /**
     * Process the payload to embed logo
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async process(payload) {
        const { design, size } = payload;

        try {
            // Get logo source
            const logoSource = design.logoUrl || design.logo || design.logoData || design.logoBase64;
            if (!logoSource) {
                return payload;
            }

            this.log('Processing logo: ' + (typeof logoSource === 'string' ? logoSource.substring(0, 50) : 'base64 data'));

            // Load logo data
            const logoData = await this.loadLogo(logoSource);
            if (!logoData) {
                this.log('Failed to load logo', 'warn');
                return payload;
            }

            // Calculate logo dimensions and position
            const logoScale = this.getDesignValue(design, 'logoScale', 0.2);
            const logoPositionX = this.getDesignValue(design, 'logoPositionX', 0.5);
            const logoPositionY = this.getDesignValue(design, 'logoPositionY', 0.5);
            const logoRotate = this.getDesignValue(design, 'logoRotate', 0);

            // Background options
            const logoBackground = this.getDesignValue(design, 'logoBackground', true);
            const logoBackgroundFill = this.getDesignValue(design, 'logoBackgroundFill', '#FFFFFF');
            const logoBackgroundScale = this.getDesignValue(design, 'logoBackgroundScale', 1.3);
            const logoBackgroundShape = this.getDesignValue(design, 'logoBackgroundShape', 'circle');

            // Calculate logo size
            const logoSize = size * logoScale;

            // Calculate position (0.5 = center)
            const logoX = (size * logoPositionX) - (logoSize / 2);
            const logoY = (size * logoPositionY) - (logoSize / 2);

            // Store logo info in payload for SVG building
            payload.logo = {
                data: logoData.base64,
                mimeType: logoData.mimeType,
                width: logoSize,
                height: logoSize,
                x: logoX,
                y: logoY,
                rotate: logoRotate,
                background: logoBackground ? {
                    shape: logoBackgroundShape,
                    fill: logoBackgroundFill,
                    scale: logoBackgroundScale,
                } : null,
            };

            this.log('Logo prepared: ' + logoSize + 'x' + logoSize + ' at (' + logoX.toFixed(1) + ', ' + logoY.toFixed(1) + ')');

        } catch (error) {
            this.log('Logo processing error: ' + error.message, 'error');
        }

        return payload;
    }

    /**
     * Load logo from URL or base64
     * @param {string} source - URL or base64 data
     * @returns {Promise<Object|null>} - { base64, mimeType }
     */
    async loadLogo(source) {
        // Check cache
        if (this.logoCache.has(source)) {
            return this.logoCache.get(source);
        }

        try {
            let logoData;

            if (source.startsWith('data:')) {
                // Base64 data URL
                logoData = this.parseDataUrl(source);
            } else if (source.startsWith('http://') || source.startsWith('https://')) {
                // Remote URL
                logoData = await this.fetchLogo(source);
            } else if (source.startsWith('/') || source.includes('\\')) {
                // Local file path
                logoData = await this.loadLocalLogo(source);
            } else {
                // Assume base64 without data URL prefix
                logoData = {
                    base64: source,
                    mimeType: 'image/png',
                };
            }

            // Cache the result
            if (logoData) {
                this.logoCache.set(source, logoData);
            }

            return logoData;

        } catch (error) {
            this.log('Failed to load logo: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Parse data URL to extract base64 and mime type
     * @param {string} dataUrl
     * @returns {Object}
     */
    parseDataUrl(dataUrl) {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            return {
                mimeType: matches[1],
                base64: matches[2],
            };
        }
        return null;
    }

    /**
     * Fetch logo from remote URL
     * @param {string} url
     * @returns {Promise<Object>}
     */
    fetchLogo(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https://') ? https : http;

            const request = protocol.get(url, { timeout: 10000 }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    // Handle redirect
                    const redirectUrl = response.headers.location;
                    this.fetchLogo(redirectUrl).then(resolve).catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error('HTTP ' + response.statusCode));
                    return;
                }

                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const mimeType = response.headers['content-type'] || 'image/png';
                    resolve({
                        base64: buffer.toString('base64'),
                        mimeType: mimeType.split(';')[0],
                    });
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Load logo from local file
     * @param {string} filePath
     * @returns {Promise<Object>}
     */
    async loadLocalLogo(filePath) {
        const fs = require('fs').promises;
        const path = require('path');

        const buffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();

        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
        };

        return {
            base64: buffer.toString('base64'),
            mimeType: mimeTypes[ext] || 'image/png',
        };
    }

    /**
     * Generate SVG elements for logo embedding
     * @param {Object} logoInfo - Logo info from payload
     * @param {number} size - QR code size
     * @returns {string} - SVG content for logo
     */
    generateLogoSVG(logoInfo) {
        if (!logoInfo) return '';

        let svg = '';
        const { x, y, width, height, rotate, background, data, mimeType } = logoInfo;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Add background if specified
        if (background) {
            const bgSize = Math.max(width, height) * background.scale;
            const bgX = centerX - bgSize / 2;
            const bgY = centerY - bgSize / 2;

            const bgPath = this.createBackgroundPath(background.shape, bgX, bgY, bgSize, bgSize);
            if (bgPath) {
                svg += '<path d="' + bgPath + '" fill="' + background.fill + '"/>\n';
            }
        }

        // Create transform for rotation
        let transform = '';
        if (rotate && rotate !== 0) {
            transform = ' transform="rotate(' + rotate + ' ' + centerX + ' ' + centerY + ')"';
        }

        // Add logo image
        const dataUrl = 'data:' + mimeType + ';base64,' + data;
        svg += '<image x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" href="' + dataUrl + '"' + transform + ' preserveAspectRatio="xMidYMid meet"/>\n';

        return svg;
    }

    /**
     * Create background path for logo
     * @param {string} shape
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {string}
     */
    createBackgroundPath(shape, x, y, width, height) {
        switch (shape) {
            case 'circle':
                return this.createCircleBackground(x, y, width, height);
            case 'square':
                return this.createSquareBackground(x, y, width, height);
            case 'rounded':
                return this.createRoundedBackground(x, y, width, height);
            default:
                return null;
        }
    }

    /**
     * Create circle background path
     */
    createCircleBackground(x, y, width, height) {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const r = Math.max(width, height) / 2;

        return 'M ' + (cx - r) + ' ' + cy + ' ' +
            'A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy + ' ' +
            'A ' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy;
    }

    /**
     * Create square background path
     */
    createSquareBackground(x, y, width, height) {
        return 'M ' + x + ' ' + y + ' ' +
            'L ' + (x + width) + ' ' + y + ' ' +
            'L ' + (x + width) + ' ' + (y + height) + ' ' +
            'L ' + x + ' ' + (y + height) + ' Z';
    }

    /**
     * Create rounded background path
     */
    createRoundedBackground(x, y, width, height) {
        const r = Math.min(width, height) * 0.15;

        return 'M ' + (x + r) + ' ' + y + ' ' +
            'L ' + (x + width - r) + ' ' + y + ' ' +
            'Q ' + (x + width) + ' ' + y + ' ' + (x + width) + ' ' + (y + r) + ' ' +
            'L ' + (x + width) + ' ' + (y + height - r) + ' ' +
            'Q ' + (x + width) + ' ' + (y + height) + ' ' + (x + width - r) + ' ' + (y + height) + ' ' +
            'L ' + (x + r) + ' ' + (y + height) + ' ' +
            'Q ' + x + ' ' + (y + height) + ' ' + x + ' ' + (y + height - r) + ' ' +
            'L ' + x + ' ' + (y + r) + ' ' +
            'Q ' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Z';
    }

    /**
     * Clear logo cache
     */
    clearCache() {
        this.logoCache.clear();
    }

    /**
     * Get supported background shapes
     * @returns {string[]}
     */
    static getSupportedBackgroundShapes() {
        return ['circle', 'square', 'rounded', 'none'];
    }
}

module.exports = LogoProcessor;
