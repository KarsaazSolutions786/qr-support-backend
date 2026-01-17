/**
 * FrameProcessor - Handles advanced shapes and frames around QR codes
 *
 * Sort Order: 110 (runs after colors/modules, before logo)
 *
 * Supported frames:
 * - none (default - no frame)
 * - scan-me (simple "Scan Me" text)
 * - four-corners-text-bottom (decorative corners with text)
 * - rounded-frame (rounded border with optional text)
 * - banner-bottom (banner at bottom for text)
 * - healthcare (medical cross icon)
 * - wifi-connect (WiFi icon frame)
 * - review-collector (star rating frame)
 * - social-follow (social media themed)
 * - ticket (ticket/coupon style)
 *
 * Features:
 * - Custom frame colors
 * - Custom text colors
 * - Drop shadow support
 * - Custom text content
 */
const BaseProcessor = require('./BaseProcessor');

class FrameProcessor extends BaseProcessor {
    constructor() {
        super('FrameProcessor', 110);

        // Frame generators
        this.frames = {
            'none': null,
            'scan-me': this.createScanMeFrame.bind(this),
            'four-corners-text-bottom': this.createFourCornersFrame.bind(this),
            'rounded-frame': this.createRoundedFrame.bind(this),
            'banner-bottom': this.createBannerBottomFrame.bind(this),
            'healthcare': this.createHealthcareFrame.bind(this),
            'wifi-connect': this.createWifiFrame.bind(this),
            'review-collector': this.createReviewFrame.bind(this),
            'social-follow': this.createSocialFrame.bind(this),
            'ticket': this.createTicketFrame.bind(this),
        };
    }

    /**
     * Check if this processor should process the payload
     * @param {Object} payload
     * @returns {boolean}
     */
    shouldProcess(payload) {
        const { design } = payload;
        const shape = design.advancedShape || design.frame || 'none';
        return shape !== 'none' && this.frames[shape];
    }

    /**
     * Process the payload to prepare frame data
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async process(payload) {
        const { design, size } = payload;

        const frameType = design.advancedShape || design.frame || 'none';
        const frameColor = design.advancedShapeFrameColor || design.frameColor || '#000000';
        const textColor = design.advancedShapeTextColor || design.textColor || '#FFFFFF';
        const dropShadow = design.advancedShapeDropShadow || design.dropShadow || false;
        const frameText = design.frameText || this.getDefaultText(frameType);

        // Calculate frame dimensions
        // Frame adds padding around QR, so we need to adjust QR position
        const framePadding = size * 0.1; // 10% padding for frame
        const textHeight = size * 0.08; // 8% for text area

        payload.frame = {
            type: frameType,
            color: frameColor,
            textColor: textColor,
            dropShadow: dropShadow,
            text: frameText,
            padding: framePadding,
            textHeight: textHeight,
        };

        this.log('Frame type: ' + frameType + ', color: ' + frameColor);

        return payload;
    }

    /**
     * Get default text for frame type
     * @param {string} frameType
     * @returns {string}
     */
    getDefaultText(frameType) {
        const defaults = {
            'scan-me': 'SCAN ME',
            'four-corners-text-bottom': 'SCAN HERE',
            'rounded-frame': 'SCAN TO VIEW',
            'banner-bottom': 'SCAN QR CODE',
            'healthcare': 'HEALTH INFO',
            'wifi-connect': 'CONNECT TO WIFI',
            'review-collector': 'LEAVE A REVIEW',
            'social-follow': 'FOLLOW US',
            'ticket': 'SCAN TICKET',
        };
        return defaults[frameType] || 'SCAN ME';
    }

    /**
     * Generate frame SVG elements
     * @param {Object} frameInfo - Frame info from payload
     * @param {number} size - Total SVG size
     * @param {number} qrSize - QR code size (without frame)
     * @returns {Object} - { beforeQR: string, afterQR: string, defs: string }
     */
    generateFrameSVG(frameInfo, size, qrSize) {
        if (!frameInfo || frameInfo.type === 'none') {
            return { beforeQR: '', afterQR: '', defs: '' };
        }

        const generator = this.frames[frameInfo.type];
        if (!generator) {
            return { beforeQR: '', afterQR: '', defs: '' };
        }

        return generator(frameInfo, size, qrSize);
    }

    // ========================================
    // Frame Generators
    // ========================================

    /**
     * Simple "Scan Me" text below QR
     */
    createScanMeFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const textY = size - (size * 0.05);
        const fontSize = size * 0.06;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        const afterQR = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle"
                  ${dropShadow ? 'filter="url(#frameShadow)"' : ''}>
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: '', afterQR, defs };
    }

    /**
     * Four corners decorative frame with text at bottom
     */
    createFourCornersFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const cornerSize = size * 0.08;
        const padding = size * 0.05;
        const textY = size - padding;
        const fontSize = size * 0.05;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        // Corner paths
        const corners = `
            <!-- Top-left corner -->
            <path d="M ${padding} ${padding + cornerSize} L ${padding} ${padding} L ${padding + cornerSize} ${padding}"
                  stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
            <!-- Top-right corner -->
            <path d="M ${size - padding - cornerSize} ${padding} L ${size - padding} ${padding} L ${size - padding} ${padding + cornerSize}"
                  stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
            <!-- Bottom-left corner -->
            <path d="M ${padding} ${size - padding - cornerSize - fontSize} L ${padding} ${size - padding - fontSize * 1.5} L ${padding + cornerSize} ${size - padding - fontSize * 1.5}"
                  stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
            <!-- Bottom-right corner -->
            <path d="M ${size - padding - cornerSize} ${size - padding - fontSize * 1.5} L ${size - padding} ${size - padding - fontSize * 1.5} L ${size - padding} ${size - padding - cornerSize - fontSize}"
                  stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
        `;

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: corners, afterQR: textElement, defs };
    }

    /**
     * Rounded border frame
     */
    createRoundedFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const padding = size * 0.03;
        const radius = size * 0.05;
        const textY = size - padding * 2;
        const fontSize = size * 0.045;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        const frame = `
            <rect x="${padding}" y="${padding}"
                  width="${size - padding * 2}" height="${size - padding * 2 - fontSize * 1.5}"
                  rx="${radius}" ry="${radius}"
                  stroke="${color}" stroke-width="2" fill="none"
                  ${dropShadow ? 'filter="url(#frameShadow)"' : ''}/>
        `;

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="600"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: frame, afterQR: textElement, defs };
    }

    /**
     * Banner at bottom
     */
    createBannerBottomFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const bannerHeight = size * 0.12;
        const bannerY = size - bannerHeight;
        const fontSize = size * 0.05;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        const banner = `
            <rect x="0" y="${bannerY}"
                  width="${size}" height="${bannerHeight}"
                  fill="${color}"
                  ${dropShadow ? 'filter="url(#frameShadow)"' : ''}/>
        `;

        const textElement = `
            <text x="${size / 2}" y="${bannerY + bannerHeight * 0.65}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: '', afterQR: banner + textElement, defs };
    }

    /**
     * Healthcare themed frame with medical cross
     */
    createHealthcareFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const crossSize = size * 0.08;
        const crossX = size / 2;
        const crossY = size * 0.06;
        const textY = size - size * 0.04;
        const fontSize = size * 0.04;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        // Medical cross
        const cross = `
            <g ${dropShadow ? 'filter="url(#frameShadow)"' : ''}>
                <rect x="${crossX - crossSize * 0.15}" y="${crossY - crossSize * 0.4}"
                      width="${crossSize * 0.3}" height="${crossSize * 0.8}"
                      fill="${color}" rx="2"/>
                <rect x="${crossX - crossSize * 0.4}" y="${crossY - crossSize * 0.15}"
                      width="${crossSize * 0.8}" height="${crossSize * 0.3}"
                      fill="${color}" rx="2"/>
            </g>
        `;

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: cross, afterQR: textElement, defs };
    }

    /**
     * WiFi themed frame
     */
    createWifiFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const iconSize = size * 0.1;
        const iconX = size / 2;
        const iconY = size * 0.08;
        const textY = size - size * 0.04;
        const fontSize = size * 0.04;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        // WiFi icon (three arcs)
        const wifiIcon = `
            <g transform="translate(${iconX}, ${iconY})" ${dropShadow ? 'filter="url(#frameShadow)"' : ''}>
                <path d="M 0 ${iconSize * 0.3} A ${iconSize * 0.5} ${iconSize * 0.5} 0 0 1 0 ${-iconSize * 0.2}"
                      stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                <path d="M 0 ${iconSize * 0.15} A ${iconSize * 0.3} ${iconSize * 0.3} 0 0 1 0 ${-iconSize * 0.05}"
                      stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                <circle cx="0" cy="${iconSize * 0.35}" r="${iconSize * 0.08}" fill="${color}"/>
            </g>
        `;

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: wifiIcon, afterQR: textElement, defs };
    }

    /**
     * Review collector with stars
     */
    createReviewFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const starSize = size * 0.04;
        const starY = size * 0.06;
        const textY = size - size * 0.04;
        const fontSize = size * 0.04;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        // Five stars
        let stars = `<g ${dropShadow ? 'filter="url(#frameShadow)"' : ''}>`;
        for (let i = 0; i < 5; i++) {
            const starX = size / 2 + (i - 2) * starSize * 1.5;
            stars += this.createStarPath(starX, starY, starSize, color);
        }
        stars += '</g>';

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: stars, afterQR: textElement, defs };
    }

    /**
     * Social media themed frame
     */
    createSocialFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const iconSize = size * 0.06;
        const textY = size - size * 0.04;
        const fontSize = size * 0.04;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        // Simple @ symbol as social icon
        const socialIcon = `
            <text x="${size / 2}" y="${size * 0.08}"
                  font-family="Arial, sans-serif"
                  font-size="${iconSize}"
                  font-weight="bold"
                  fill="${color}"
                  text-anchor="middle"
                  ${dropShadow ? 'filter="url(#frameShadow)"' : ''}>
                @
            </text>
        `;

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: socialIcon, afterQR: textElement, defs };
    }

    /**
     * Ticket/coupon style frame
     */
    createTicketFrame(frameInfo, size, qrSize) {
        const { color, textColor, text, dropShadow } = frameInfo;
        const padding = size * 0.02;
        const notchSize = size * 0.03;
        const textY = size - size * 0.04;
        const fontSize = size * 0.04;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('frameShadow');
        }

        // Ticket border with notches
        const ticketBorder = `
            <path d="
                M ${padding + notchSize} ${padding}
                L ${size - padding - notchSize} ${padding}
                A ${notchSize} ${notchSize} 0 0 0 ${size - padding - notchSize} ${padding + notchSize * 2}
                L ${size - padding - notchSize} ${size - padding - fontSize * 2}
                L ${padding + notchSize} ${size - padding - fontSize * 2}
                L ${padding + notchSize} ${padding + notchSize * 2}
                A ${notchSize} ${notchSize} 0 0 0 ${padding + notchSize} ${padding}
                Z
            " stroke="${color}" stroke-width="2" fill="none" stroke-dasharray="5,3"
            ${dropShadow ? 'filter="url(#frameShadow)"' : ''}/>
        `;

        const textElement = `
            <text x="${size / 2}" y="${textY}"
                  font-family="Arial, sans-serif"
                  font-size="${fontSize}"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle">
                ${this.escapeXml(text)}
            </text>
        `;

        return { beforeQR: ticketBorder, afterQR: textElement, defs };
    }

    // ========================================
    // Helper Methods
    // ========================================

    /**
     * Create drop shadow filter definition
     */
    createDropShadowDef(id) {
        return `
            <filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
            </filter>
        `;
    }

    /**
     * Create a star path
     */
    createStarPath(cx, cy, size, fill) {
        const outerR = size;
        const innerR = size * 0.4;
        const points = 5;
        let path = '';

        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);

            if (i === 0) {
                path = 'M ' + x + ' ' + y;
            } else {
                path += ' L ' + x + ' ' + y;
            }
        }
        path += ' Z';

        return '<path d="' + path + '" fill="' + fill + '"/>';
    }

    /**
     * Escape XML special characters
     */
    escapeXml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Get list of supported frame types
     */
    static getSupportedFrames() {
        return [
            'none',
            'scan-me',
            'four-corners-text-bottom',
            'rounded-frame',
            'banner-bottom',
            'healthcare',
            'wifi-connect',
            'review-collector',
            'social-follow',
            'ticket',
        ];
    }
}

module.exports = FrameProcessor;
