/**
 * SVG to PNG Conversion Service
 *
 * Uses Sharp library for high-quality SVG to PNG conversion.
 * Sharp uses libvips under the hood, which has excellent SVG support.
 */

const sharp = require('sharp');
const logger = require('../utils/logger');

class SvgToPngService {
    constructor() {
        this.defaultSize = parseInt(process.env.DEFAULT_PNG_SIZE) || 512;
        this.defaultQuality = parseInt(process.env.DEFAULT_PNG_QUALITY) || 90;
        this.maxSize = parseInt(process.env.MAX_PNG_SIZE) || 2048;
        this.minSize = parseInt(process.env.MIN_PNG_SIZE) || 64;
    }

    /**
     * Convert SVG string to PNG buffer
     *
     * @param {string} svgContent - SVG content as string
     * @param {object} options - Conversion options
     * @returns {Promise<Buffer>} PNG buffer
     */
    async convert(svgContent, options = {}) {
        const startTime = Date.now();

        try {
            const size = this.clampSize(options.size || this.defaultSize);
            const quality = Math.min(100, Math.max(1, options.quality || this.defaultQuality));

            // Preprocess SVG for better compatibility
            const processedSvg = this.preprocessSvg(svgContent, size);

            // Convert using Sharp
            const pngBuffer = await sharp(Buffer.from(processedSvg))
                .resize(size, size, {
                    fit: 'contain',
                    background: options.transparent
                        ? { r: 0, g: 0, b: 0, alpha: 0 }
                        : { r: 255, g: 255, b: 255, alpha: 1 },
                })
                .png({
                    quality: quality,
                    compressionLevel: 9,
                })
                .toBuffer();

            const duration = Date.now() - startTime;
            logger.debug(`SVG to PNG conversion completed in ${duration}ms, size: ${pngBuffer.length} bytes`);

            return pngBuffer;
        } catch (error) {
            logger.error(`SVG to PNG conversion failed: ${error.message}`);
            throw new Error(`PNG conversion failed: ${error.message}`);
        }
    }

    /**
     * Convert SVG to base64-encoded PNG
     *
     * @param {string} svgContent - SVG content
     * @param {object} options - Conversion options
     * @returns {Promise<string>} Base64 encoded PNG
     */
    async convertToBase64(svgContent, options = {}) {
        const pngBuffer = await this.convert(svgContent, options);
        return pngBuffer.toString('base64');
    }

    /**
     * Convert SVG to data URL
     *
     * @param {string} svgContent - SVG content
     * @param {object} options - Conversion options
     * @returns {Promise<string>} Data URL
     */
    async convertToDataUrl(svgContent, options = {}) {
        const base64 = await this.convertToBase64(svgContent, options);
        return `data:image/png;base64,${base64}`;
    }

    /**
     * Generate thumbnail from SVG
     *
     * @param {string} svgContent - SVG content
     * @param {number} size - Thumbnail size (default 128)
     * @returns {Promise<string>} Base64 encoded thumbnail
     */
    async generateThumbnail(svgContent, size = 128) {
        return this.convertToBase64(svgContent, {
            size: Math.min(size, 256),
            quality: 80,
        });
    }

    /**
     * Preprocess SVG for better Sharp compatibility
     *
     * @param {string} svgContent - Original SVG
     * @param {number} targetSize - Target render size
     * @returns {string} Processed SVG
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
     * Convert CSS styles to inline attributes
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
                const classRegex = new RegExp(`class=["']([^"']*\\b${className}\\b[^"']*)["']`, 'g');

                processed = processed.replace(classRegex, (match, classes) => {
                    const styleStr = Object.entries(properties)
                        .map(([prop, val]) => `${this.cssToAttr(prop)}="${val}"`)
                        .join(' ');
                    return `${match} ${styleStr}`;
                });
            }
        }

        // Remove style block after inlining
        processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        return processed;
    }

    /**
     * Parse CSS rules from style content
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
     * Convert CSS property to SVG attribute
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
     * Fix common SVG issues that cause rendering problems
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

        // Ensure all colors are in proper format
        fixed = fixed.replace(/#([0-9a-fA-F]{3})(?![0-9a-fA-F])/g, '#$1$1');

        return fixed;
    }

    /**
     * Clamp size to valid range
     */
    clampSize(size) {
        return Math.min(this.maxSize, Math.max(this.minSize, size));
    }

    /**
     * Get service info
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
