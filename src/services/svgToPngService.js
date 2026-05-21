/**
 * SVG to PNG Conversion Service
 *
 * Uses Sharp library for high-quality SVG to PNG conversion.
 * Sharp uses libvips under the hood, which has excellent SVG support.
 *
 * Concurrency control:
 *   A promise-based semaphore limits simultaneous Sharp operations to
 *   os.cpus().length. This prevents memory exhaustion under load — Sharp/libvips
 *   allocates a decode buffer per operation; running too many in parallel on a
 *   heavily-loaded node causes OOM before CPU becomes the bottleneck.
 *   Excess requests are queued (not rejected) and processed FIFO.
 */

/**
     * Purpose: Convert SVG string to PNG buffer
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

const os = require('os');
const sharp = require('sharp');
const logger = require('../utils/logger');

/**
 * Simple promise-based semaphore for concurrency limiting.
 * No external packages required.
 *
 * @param {number} concurrency - Maximum simultaneous operations
 */
function createSemaphore(concurrency) {
    let active = 0;
    const queue = [];

    function tryNext() {
        if (queue.length === 0 || active >= concurrency) return;
        active++;
        const { resolve } = queue.shift();
        resolve();
    }

    /**
     * Acquire a slot. Awaiting this function will pause the caller
     * until a slot is available.
     * @returns {Promise<Function>} release — must be called when the slot can be freed.
     */
    function acquire() {
        return new Promise((resolve) => {
            queue.push({ resolve });
            tryNext();
        }).then(() => {
            // Return a release function
            return function release() {
                active--;
                tryNext();
            };
        });
    }

    return { acquire };
}

class SvgToPngService {
    /**
     * Purpose: Constructor for constructor.
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    constructor() {
        this.defaultSize = parseInt(process.env.DEFAULT_PNG_SIZE) || 512;
        this.defaultQuality = parseInt(process.env.DEFAULT_PNG_QUALITY) || 90;
        this.maxSize = parseInt(process.env.MAX_PNG_SIZE) || 2048;
        this.minSize = parseInt(process.env.MIN_PNG_SIZE) || 64;

        // Proxy mode: forward conversions to Laravel backend (30-day transition)
        this.useLaravelConverter = process.env.USE_LARAVEL_CONVERTER === 'true';
        this.laravelBackendUrl = process.env.LARAVEL_BACKEND_URL || 'http://localhost:8000';
    }

    /**
     * Convert SVG string to PNG buffer
     *
     * @param {string} svgContent - SVG content as string
     * @param {object} options - Conversion options
     * @returns {Promise<Buffer>} PNG buffer
     */
    async convert(svgContent, options = {}) {
        // Proxy mode: forward to Laravel backend during transition period
        if (this.useLaravelConverter && !options._localFallback) {
            try {
                return await this.proxyToLaravel(svgContent, options);
            } catch (proxyError) {
                logger.warn(`Laravel proxy failed, falling back to local conversion: ${proxyError.message}`);
                // Fall through to local conversion
            }
        }

        const startTime = Date.now();

        // Acquire a concurrency slot before allocating Sharp buffers.
        // This queues the caller if all slots are occupied, preventing memory
        // exhaustion under burst load.
        const release = await this._semaphore.acquire();

        try {
            const width = this.clampSize(options.width || options.size || this.defaultSize);
            const height = this.clampSize(options.height || options.size || this.defaultSize);
            const quality = Math.min(100, Math.max(1, options.quality || this.defaultQuality));

            // If preprocessed flag is set, skip preprocessing
            // The SVG has already been processed by svgPreprocessor
            let processedSvg = svgContent;
            if (!options.preprocessed) {
                processedSvg = this.preprocessSvg(svgContent, width);
            }

            // Parse background color
            const bgColor = this.parseBackgroundColor(options.background, options.transparent);

            logger.debug(`Converting SVG to PNG: ${width}x${height}, bg=${JSON.stringify(bgColor)}`);

            // Convert using Sharp with optimized settings
            const pngBuffer = await sharp(Buffer.from(processedSvg), {
                // Density 72 is sufficient for screen display, 150 was overkill
                density: 72,
                // Limit input to 16384x16384 pixels (268 megapixels) to prevent DoS
                limitInputPixels: 268402689,
            })
                .resize(width, height, {
                    fit: 'contain',
                    background: bgColor,
                    // Use faster kernel for resize
                    kernel: 'lanczos2',
                })
                .png({
                    quality: quality,
                    // Level 6 is good balance of speed vs size (9 was too slow)
                    compressionLevel: 6,
                    // Use adaptive filtering for better compression
                    adaptiveFiltering: true,
                })
                .toBuffer();

            const duration = Date.now() - startTime;
            logger.debug(`SVG to PNG conversion completed in ${duration}ms, size: ${pngBuffer.length} bytes`);

            return pngBuffer;
        } catch (error) {
            logger.error(`SVG conversion failed: ${error.message}`, {
                svgLength: svgContent.length,
                svgPreview: svgContent.substring(0, 100).replace(/[^\x20-\x7E]/g, '?'),
                // DO NOT log full SVG content
            });
            throw new Error('PNG conversion failed. The SVG content may be invalid.');
        } finally {
            // Always release the semaphore slot, even on error
            release();
        }
    }

    /**
     * Purpose: Parse background color option
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    parseBackgroundColor(background, transparent) {
        if (transparent) {
            return { r: 0, g: 0, b: 0, alpha: 0 };
        }

        if (!background) {
            return { r: 255, g: 255, b: 255, alpha: 1 };
        }

        // Already an object
        if (typeof background === 'object') {
            return {
                r: background.r || 255,
                g: background.g || 255,
                b: background.b || 255,
                alpha: background.alpha !== undefined ? background.alpha : 1,
            };
        }

        // Parse hex color
        if (typeof background === 'string') {
            let hex = background.trim();

            // Remove # prefix
            if (hex.startsWith('#')) {
                hex = hex.slice(1);
            }

            // Expand 3-digit hex
            if (hex.length === 3) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }

            // Parse
            if (hex.length === 6 || hex.length === 8) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

                if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                    return { r, g, b, alpha: a };
                }
            }

            // Handle 'none' or 'transparent'
            if (hex.toLowerCase() === 'none' || hex.toLowerCase() === 'transparent') {
                return { r: 0, g: 0, b: 0, alpha: 0 };
            }
        }

        // Default to white
        return { r: 255, g: 255, b: 255, alpha: 1 };
    }

    /**
     * Purpose: Convert SVG to base64-encoded PNG
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    async convertToBase64(svgContent, options = {}) {
        const pngBuffer = await this.convert(svgContent, options);
        return pngBuffer.toString('base64');
    }

    /**
     * Purpose: Convert SVG to data URL
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    async convertToDataUrl(svgContent, options = {}) {
        const base64 = await this.convertToBase64(svgContent, options);
        return `data:image/png;base64,${base64}`;
    }

    /**
     * Purpose: Generate thumbnail from SVG
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    async generateThumbnail(svgContent, size = 128) {
        return this.convertToBase64(svgContent, {
            size: Math.min(size, 256),
            quality: 80,
        });
    }

    /**
     * Purpose: Preprocess SVG for better Sharp compatibility
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    preprocessSvg(svgContent, targetSize) {
        let processed = svgContent;

        // Ensure SVG has proper XML declaration
        if (!processed.startsWith('<?xml')) {
            processed = '<?xml version="1.0" encoding="UTF-8"?>\n' + processed;
        }

        // Add width/height attributes if missing
        if (!processed.includes('width=') || !processed.includes('height=')) {
            processed = processed.replace(
                /<svg([^>]*)>/,
                `<svg$1 width="${targetSize}" height="${targetSize}">`
            );
        }

        // Ensure viewBox exists
        if (!processed.includes('viewBox')) {
            processed = processed.replace(
                /<svg([^>]*)>/,
                `<svg$1 viewBox="0 0 ${targetSize} ${targetSize}">`
            );
        }

        // Convert CSS styles to inline attributes for better compatibility
        processed = this.convertCssToInline(processed);

        // Fix common SVG issues
        processed = this.fixCommonSvgIssues(processed);

        return processed;
    }

    /**
     * Purpose: Convert CSS styles to inline attributes
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    convertCssToInline(svg) {
        // Extract style rules
        const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (!styleMatch) return svg;

        const styleContent = styleMatch[1];
        let processed = svg;

        // Parse CSS rules
        const cssRules = this.parseCssRules(styleContent);

        // Apply rules to elements
        for (const [selector, properties] of Object.entries(cssRules)) {
            // Handle class selectors
            if (selector.startsWith('.')) {
                const className = selector.slice(1);
                // Match the entire element tag to check for existing attributes
                const elementRegex = new RegExp(`<(\\w+)([^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)>`, 'g');

                processed = processed.replace(elementRegex, (match, tagName, attributes) => {
                    let newAttributes = attributes;

                    for (const [prop, val] of Object.entries(properties)) {
                        const attrName = this.cssToAttr(prop);
                        // Only add attribute if it doesn't already exist on the element
                        const attrRegex = new RegExp(`\\b${attrName}\\s*=\\s*["'][^"']*["']`, 'i');
                        if (!attrRegex.test(attributes)) {
                            newAttributes += ` ${attrName}="${val}"`;
                        }
                    }

                    return `<${tagName}${newAttributes}>`;
                });
            }
        }

        // Remove style block after inlining
        processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        return processed;
    }

    /**
     * Purpose: Parse CSS rules from style content
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    parseCssRules(styleContent) {
        const rules = {};
        const ruleRegex = /([.#]?[\w-]+)\s*\{([^}]+)\}/g;
        let match;

        while ((match = ruleRegex.exec(styleContent)) !== null) {
            const selector = match[1].trim();
            const declarations = match[2].trim();
            const properties = {};

            declarations.split(';').forEach(decl => {
                const [prop, val] = decl.split(':').map(s => s.trim());
                if (prop && val) {
                    properties[prop] = val;
                }
            });

            rules[selector] = properties;
        }

        return rules;
    }

    /**
     * Purpose: Convert CSS property to SVG attribute
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    cssToAttr(cssProp) {
        const mapping = {
            'fill': 'fill',
            'stroke': 'stroke',
            'stroke-width': 'stroke-width',
            'opacity': 'opacity',
            'fill-opacity': 'fill-opacity',
            'stroke-opacity': 'stroke-opacity',
        };
        return mapping[cssProp] || cssProp;
    }

    /**
     * Purpose: Fix common SVG issues that cause rendering problems
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    fixCommonSvgIssues(svg) {
        let fixed = svg;

        // Remove unsupported CSS properties
        fixed = fixed.replace(/mix-blend-mode:[^;}"']+[;]?/gi, '');

        // Fix malformed path data
        fixed = fixed.replace(/d="([^"]+)"/g, (match, pathData) => {
            // Ensure proper spacing in path commands
            const fixedPath = pathData
                .replace(/([MmLlHhVvCcSsQqTtAaZz])(\d)/g, '$1 $2')
                .replace(/(\d)([MmLlHhVvCcSsQqTtAaZz])/g, '$1 $2');
            return `d="${fixedPath}"`;
        });

        // Correct: #ABC -> #AABBCC (expand each digit)
        fixed = fixed.replace(
            /#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])(?![0-9a-fA-F])/g,
            '#$1$1$2$2$3$3'
        );

        return fixed;
    }

    /**
     * Purpose: Proxy SVG-to-PNG conversion to the Laravel backend. Used during the 30-day transition period when USE_LARAVEL_CONVERTER=true. Falls back to local Sharp conversion on failure.
     * Owner/Author: Syed Ashhad
     * Created/Updated: March 2026
     */

    async proxyToLaravel(svgContent, options = {}) {
        const axios = require('axios');

        const width = this.clampSize(options.width || options.size || this.defaultSize);
        const quality = Math.min(100, Math.max(1, options.quality || this.defaultQuality));

        const response = await axios.post(
            `${this.laravelBackendUrl}/api/flutter/qr/render`,
            {
                svg: svgContent,
                size: width,
                quality: quality,
            },
            {
                timeout: parseInt(process.env.LARAVEL_API_TIMEOUT) || 30000,
                responseType: 'arraybuffer',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'image/png',
                },
            }
        );

        logger.debug(`Laravel proxy conversion successful: ${response.data.length} bytes`);
        return Buffer.from(response.data);
    }

    /**
     * Purpose: Clamp size to valid range
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    clampSize(size) {
        return Math.min(this.maxSize, Math.max(this.minSize, size));
    }

    /**
     * Purpose: Get service info
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */

    getInfo() {
        return {
            defaultSize: this.defaultSize,
            defaultQuality: this.defaultQuality,
            maxSize: this.maxSize,
            minSize: this.minSize,
            sharpVersion: sharp.versions,
        };
    }
}

module.exports = new SvgToPngService();
