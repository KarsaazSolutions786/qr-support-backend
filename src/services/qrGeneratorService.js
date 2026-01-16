/**
 * QR Code Generator Service
 *
 * Generates styled QR codes directly in Node.js.
 * This gives full control over QR appearance without depending on Laravel.
 */

const QRCode = require('qrcode');
const sharp = require('sharp');
const logger = require('../utils/logger');

class QRGeneratorService {
    /**
     * Generate a styled QR code as PNG
     *
     * @param {string} data - Data to encode in QR code
     * @param {object} design - Design configuration
     * @param {number} size - Output size in pixels
     * @param {number} quality - PNG quality (1-100)
     * @returns {Promise<Buffer>} PNG buffer
     */
    async generate(data, design = {}, size = 512, quality = 90) {
        const startTime = Date.now();

        try {
            // Parse design options
            const foregroundColor = this.parseColor(design.foreground_color) || '#000000';
            const backgroundColor = this.parseColor(design.background_color) || '#FFFFFF';
            const errorCorrection = this.parseErrorCorrection(design.error_correction);
            const margin = design.margin ?? 4;

            logger.debug(`Generating QR: data=${data.substring(0, 50)}..., fg=${foregroundColor}, bg=${backgroundColor}`);

            // Generate QR as SVG first (for better quality)
            const svgString = await QRCode.toString(data, {
                type: 'svg',
                errorCorrectionLevel: errorCorrection,
                margin: margin,
                color: {
                    dark: foregroundColor,
                    light: backgroundColor,
                },
                width: size,
            });

            // Apply additional styling to SVG if needed
            const styledSvg = this.applyAdvancedStyling(svgString, design, size);

            // Convert SVG to PNG using Sharp
            const pngBuffer = await sharp(Buffer.from(styledSvg))
                .resize(size, size, {
                    fit: 'contain',
                    background: this.hexToRgba(backgroundColor),
                })
                .png({ quality })
                .toBuffer();

            const duration = Date.now() - startTime;
            logger.debug(`QR generated in ${duration}ms, size: ${pngBuffer.length} bytes`);

            return pngBuffer;
        } catch (error) {
            logger.error(`QR generation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate QR code as SVG string
     */
    async generateSvg(data, design = {}, size = 512) {
        const foregroundColor = this.parseColor(design.foreground_color) || '#000000';
        const backgroundColor = this.parseColor(design.background_color) || '#FFFFFF';
        const errorCorrection = this.parseErrorCorrection(design.error_correction);
        const margin = design.margin ?? 4;

        const svgString = await QRCode.toString(data, {
            type: 'svg',
            errorCorrectionLevel: errorCorrection,
            margin: margin,
            color: {
                dark: foregroundColor,
                light: backgroundColor,
            },
            width: size,
        });

        return this.applyAdvancedStyling(svgString, design, size);
    }

    /**
     * Apply advanced styling to SVG (gradients, rounded modules, etc.)
     */
    applyAdvancedStyling(svgString, design, size) {
        let svg = svgString;

        // Apply gradient if specified
        if (design.fill_type === 'gradient' || design.fillType === 'gradient') {
            svg = this.applyGradient(svg, design, size);
        }

        // Apply rounded corners to modules if specified
        const moduleShape = design.module_shape || design.module || 'square';
        if (moduleShape === 'dots' || moduleShape === 'circle' || moduleShape === 'rounded') {
            svg = this.applyRoundedModules(svg, moduleShape);
        }

        return svg;
    }

    /**
     * Apply gradient fill to QR code
     */
    applyGradient(svgString, design, size) {
        const gradientFill = design.gradient_fill || design.gradientFill;
        if (!gradientFill) return svgString;

        const gradientType = (gradientFill.type || 'LINEAR').toUpperCase();
        const colors = gradientFill.colors || [];

        if (colors.length < 2) return svgString;

        // Create gradient definition
        let gradientDef = '';
        const gradientId = 'qr-gradient';

        if (gradientType === 'LINEAR') {
            const angle = gradientFill.angle || 0;
            const { x1, y1, x2, y2 } = this.angleToCoords(angle);

            gradientDef = `<linearGradient id="${gradientId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">`;
            colors.forEach((c, i) => {
                const stop = c.stop ?? (i / (colors.length - 1) * 100);
                const color = this.parseColor(c.color) || '#000000';
                gradientDef += `<stop offset="${stop}%" stop-color="${color}"/>`;
            });
            gradientDef += '</linearGradient>';
        } else if (gradientType === 'RADIAL') {
            gradientDef = `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">`;
            colors.forEach((c, i) => {
                const stop = c.stop ?? (i / (colors.length - 1) * 100);
                const color = this.parseColor(c.color) || '#000000';
                gradientDef += `<stop offset="${stop}%" stop-color="${color}"/>`;
            });
            gradientDef += '</radialGradient>';
        }

        // Insert gradient into SVG defs
        let svg = svgString;
        if (svg.includes('<defs>')) {
            svg = svg.replace('<defs>', `<defs>${gradientDef}`);
        } else {
            svg = svg.replace('<svg', `<svg><defs>${gradientDef}</defs`);
            svg = svg.replace('<svg><defs>', '<svg><defs>');
        }

        // Replace dark color with gradient
        svg = svg.replace(/fill="[^"]*"(?=[^>]*class="[^"]*dark)/g, `fill="url(#${gradientId})"`);
        svg = svg.replace(/fill:#[0-9a-fA-F]{3,8}/g, `fill:url(#${gradientId})`);

        return svg;
    }

    /**
     * Convert angle to gradient coordinates
     */
    angleToCoords(angle) {
        const rad = (angle * Math.PI) / 180;
        return {
            x1: Math.round(50 - Math.cos(rad) * 50),
            y1: Math.round(50 - Math.sin(rad) * 50),
            x2: Math.round(50 + Math.cos(rad) * 50),
            y2: Math.round(50 + Math.sin(rad) * 50),
        };
    }

    /**
     * Apply rounded/circular modules to QR code
     * Note: This is a simplified version - for complex shapes, use the styled SVG from Laravel
     */
    applyRoundedModules(svgString, shape) {
        // For basic styling, we just return as-is
        // The qrcode library generates squares, and converting each to circles
        // requires complex SVG manipulation
        // For production, consider using a library like qr-code-styling
        return svgString;
    }

    /**
     * Parse color value to hex
     */
    parseColor(color) {
        if (!color) return null;

        let c = color.toString().trim();

        // Already hex
        if (c.startsWith('#')) {
            // Expand shorthand (#RGB -> #RRGGBB)
            if (c.length === 4) {
                c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
            }
            return c.toUpperCase();
        }

        // rgb() format
        const rgbMatch = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`.toUpperCase();
        }

        return color;
    }

    /**
     * Convert hex color to RGBA object for Sharp
     */
    hexToRgba(hex) {
        const color = this.parseColor(hex) || '#FFFFFF';
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);

        if (result) {
            return {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
                alpha: 1,
            };
        }

        return { r: 255, g: 255, b: 255, alpha: 1 };
    }

    /**
     * Parse error correction level
     */
    parseErrorCorrection(level) {
        const l = (level || 'M').toUpperCase();
        if (['L', 'M', 'Q', 'H'].includes(l)) {
            return l;
        }
        return 'M';
    }

    /**
     * Encode data based on QR type
     */
    encodeData(type, data) {
        switch (type) {
            case 'url':
                return data.url || data.content || '';

            case 'text':
                return data.text || data.content || '';

            case 'email':
                let email = `mailto:${data.email || ''}`;
                if (data.subject) email += `?subject=${encodeURIComponent(data.subject)}`;
                if (data.body) email += `${data.subject ? '&' : '?'}body=${encodeURIComponent(data.body)}`;
                return email;

            case 'phone':
                return `tel:${data.phone || data.number || ''}`;

            case 'sms':
                let sms = `sms:${data.phone || data.number || ''}`;
                if (data.message) sms += `?body=${encodeURIComponent(data.message)}`;
                return sms;

            case 'wifi':
                const ssid = data.ssid || '';
                const password = data.password || '';
                const encryption = (data.encryption || 'WPA').toUpperCase();
                const hidden = data.hidden ? 'true' : 'false';
                return `WIFI:T:${encryption};S:${ssid};P:${password};H:${hidden};;`;

            case 'vcard':
                return this.encodeVCard(data);

            case 'location':
            case 'geo':
                const lat = data.latitude || data.lat || 0;
                const lng = data.longitude || data.lng || data.lon || 0;
                return `geo:${lat},${lng}`;

            default:
                return data.content || data.text || data.url || JSON.stringify(data);
        }
    }

    /**
     * Encode vCard data
     */
    encodeVCard(data) {
        let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';

        if (data.firstName || data.lastName) {
            vcard += `N:${data.lastName || ''};${data.firstName || ''};;;\n`;
            vcard += `FN:${data.firstName || ''} ${data.lastName || ''}\n`;
        }
        if (data.organization || data.company) {
            vcard += `ORG:${data.organization || data.company}\n`;
        }
        if (data.title || data.jobTitle) {
            vcard += `TITLE:${data.title || data.jobTitle}\n`;
        }
        if (data.phone) {
            vcard += `TEL:${data.phone}\n`;
        }
        if (data.email) {
            vcard += `EMAIL:${data.email}\n`;
        }
        if (data.website || data.url) {
            vcard += `URL:${data.website || data.url}\n`;
        }
        if (data.address) {
            vcard += `ADR:;;${data.address};;;;\n`;
        }

        vcard += 'END:VCARD';
        return vcard;
    }
}

module.exports = new QRGeneratorService();
