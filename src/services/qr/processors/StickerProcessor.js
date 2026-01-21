/**
 * StickerProcessor - Handles center overlay stickers on QR codes
 *
 * Sort Order: 105 (runs after modules/finders, before frames)
 *
 * Stickers are overlays placed in the center area of the QR code,
 * different from frames which are borders/text around the QR.
 *
 * Supported stickers:
 * - coupon (coupon/discount badge)
 * - sale (sale badge)
 * - discount (percentage off badge)
 * - new (new arrival badge)
 * - hot (trending/hot badge)
 * - star-badge (star rating badge)
 * - heart-badge (like/favorite badge)
 * - check-badge (verified badge)
 * - info-badge (information badge)
 * - gift-badge (gift/present badge)
 * - location-pin (location marker)
 * - qr-details (QR info overlay)
 * - pincode-protected (lock/security overlay)
 *
 * Features:
 * - Semi-transparent backgrounds
 * - Custom colors
 * - Text support
 * - Icon overlays
 * - Drop shadow support
 */
const BaseProcessor = require('./BaseProcessor');

class StickerProcessor extends BaseProcessor {
    constructor() {
        super('StickerProcessor', 105);

        // Sticker generators
        this.stickers = {
            'none': null,
            'coupon': this.createCouponSticker.bind(this),
            'sale': this.createSaleSticker.bind(this),
            'discount': this.createDiscountSticker.bind(this),
            'new': this.createNewSticker.bind(this),
            'hot': this.createHotSticker.bind(this),
            'star-badge': this.createStarBadgeSticker.bind(this),
            'starBadge': this.createStarBadgeSticker.bind(this),
            'heart-badge': this.createHeartBadgeSticker.bind(this),
            'heartBadge': this.createHeartBadgeSticker.bind(this),
            'check-badge': this.createCheckBadgeSticker.bind(this),
            'checkBadge': this.createCheckBadgeSticker.bind(this),
            'info-badge': this.createInfoBadgeSticker.bind(this),
            'infoBadge': this.createInfoBadgeSticker.bind(this),
            'gift-badge': this.createGiftBadgeSticker.bind(this),
            'giftBadge': this.createGiftBadgeSticker.bind(this),
            'location-pin': this.createLocationPinSticker.bind(this),
            'locationPin': this.createLocationPinSticker.bind(this),
            'qr-details': this.createQRDetailsSticker.bind(this),
            'qrDetails': this.createQRDetailsSticker.bind(this),
            'qrcode-details': this.createQRDetailsSticker.bind(this),
            'pincode-protected': this.createPincodeSticker.bind(this),
            'pincodeProtected': this.createPincodeSticker.bind(this),
            'wifi-badge': this.createWifiBadgeSticker.bind(this),
            'wifiBadge': this.createWifiBadgeSticker.bind(this),
            'scan-badge': this.createScanBadgeSticker.bind(this),
            'scanBadge': this.createScanBadgeSticker.bind(this),
        };
    }

    /**
     * Check if this processor should process the payload
     * @param {Object} payload
     * @returns {boolean}
     */
    shouldProcess(payload) {
        const { design } = payload;
        // Also check advancedShape - Flutter sends sticker type via this field
        const sticker = design.sticker || design.centerSticker || design.stickerType || design.advancedShape;
        const shouldProcess = sticker && sticker !== 'none' && !!this.stickers[sticker];
        this.log(`shouldProcess: sticker='${sticker}', advancedShape='${design.advancedShape}', hasGenerator=${!!this.stickers[sticker]}, result=${shouldProcess}`);
        return shouldProcess;
    }

    /**
     * Process the payload to prepare sticker data
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async process(payload) {
        const { design, size } = payload;

        // Also check advancedShape - Flutter sends sticker type via this field
        const stickerType = design.sticker || design.centerSticker || design.stickerType || design.advancedShape || 'none';
        // Flutter sends colors via advancedShapeFrameColor
        const stickerColor = design.stickerColor || design.stickerBackgroundColor || design.advancedShapeFrameColor || '#FF4444';
        const stickerTextColor = design.stickerTextColor || design.textColor || '#FFFFFF';
        const stickerText = design.stickerText || design.text || this.getDefaultText(stickerType);
        const stickerScale = design.stickerScale || 0.25; // 25% of QR size
        // Flutter sends drop shadow via advancedShapeDropShadow
        const dropShadow = design.stickerDropShadow !== false && design.advancedShapeDropShadow !== false;

        // Calculate sticker dimensions
        const stickerSize = size * stickerScale;
        const stickerX = (size - stickerSize) / 2;
        const stickerY = (size - stickerSize) / 2;

        payload.sticker = {
            type: stickerType,
            color: stickerColor,
            textColor: stickerTextColor,
            text: stickerText,
            size: stickerSize,
            x: stickerX,
            y: stickerY,
            dropShadow: dropShadow,
        };

        this.log(`Sticker type: ${stickerType}, size: ${stickerSize}px`);

        return payload;
    }

    /**
     * Get default text for sticker type
     * @param {string} stickerType
     * @returns {string}
     */
    getDefaultText(stickerType) {
        const defaults = {
            'coupon': 'COUPON',
            'sale': 'SALE',
            'discount': '-20%',
            'new': 'NEW',
            'hot': 'HOT',
            'star-badge': '',
            'heart-badge': '',
            'check-badge': '',
            'info-badge': 'i',
            'gift-badge': '',
            'location-pin': '',
            'qr-details': 'QR',
            'pincode-protected': '',
            'wifi-badge': '',
            'scan-badge': 'SCAN',
        };
        return defaults[stickerType] || '';
    }

    /**
     * Generate sticker SVG elements
     * @param {Object} stickerInfo - Sticker info from payload
     * @param {number} svgSize - Total SVG size
     * @returns {Object} - { element: string, defs: string }
     */
    generateStickerSVG(stickerInfo, svgSize) {
        if (!stickerInfo || stickerInfo.type === 'none') {
            return { element: '', defs: '' };
        }

        const generator = this.stickers[stickerInfo.type];
        if (!generator) {
            return { element: '', defs: '' };
        }

        return generator(stickerInfo, svgSize);
    }

    // ========================================
    // Sticker Generators
    // ========================================

    /**
     * Coupon badge sticker
     */
    createCouponSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const fontSize = size * 0.25;
        const notchSize = size * 0.08;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // Coupon shape with notches
        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <path d="
                    M ${x + notchSize} ${y}
                    L ${x + size - notchSize} ${y}
                    A ${notchSize} ${notchSize} 0 0 0 ${x + size - notchSize} ${y + notchSize * 2}
                    L ${x + size - notchSize} ${y + size - notchSize * 2}
                    A ${notchSize} ${notchSize} 0 0 0 ${x + size - notchSize} ${y + size}
                    L ${x + notchSize} ${y + size}
                    A ${notchSize} ${notchSize} 0 0 0 ${x + notchSize} ${y + size - notchSize * 2}
                    L ${x + notchSize} ${y + notchSize * 2}
                    A ${notchSize} ${notchSize} 0 0 0 ${x + notchSize} ${y}
                    Z
                " fill="${color}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor}"
                      text-anchor="middle">
                    ${this.escapeXml(text)}
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Sale badge sticker (circular)
     */
    createSaleSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.9;
        const fontSize = size * 0.3;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor}"
                      text-anchor="middle">
                    ${this.escapeXml(text || 'SALE')}
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Discount badge sticker (starburst)
     */
    createDiscountSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const outerR = size / 2 * 0.95;
        const innerR = outerR * 0.75;
        const points = 12;
        const fontSize = size * 0.25;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // Create starburst path
        let path = '';
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            path += (i === 0 ? 'M' : 'L') + ` ${px} ${py} `;
        }
        path += 'Z';

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <path d="${path}" fill="${color}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor}"
                      text-anchor="middle">
                    ${this.escapeXml(text || '-20%')}
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * New badge sticker
     */
    createNewSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85;
        const fontSize = size * 0.35;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color || '#00C853'}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor}"
                      text-anchor="middle">
                    ${this.escapeXml(text || 'NEW')}
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Hot badge sticker (flame icon)
     */
    createHotSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85;
        const fontSize = size * 0.3;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color || '#FF5722'}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor}"
                      text-anchor="middle">
                    ${this.escapeXml(text || 'HOT')}
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Star badge sticker
     */
    createStarBadgeSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const outerR = size / 2 * 0.9;
        const innerR = outerR * 0.4;
        const points = 5;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // Create star path
        let path = '';
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            path += (i === 0 ? 'M' : 'L') + ` ${px} ${py} `;
        }
        path += 'Z';

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <path d="${path}" fill="${color || '#FFD700'}"/>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Heart badge sticker
     */
    createHeartBadgeSticker(info, svgSize) {
        const { x, y, size, color, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const scale = size * 0.8;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // Heart shape
        const heartPath = `
            M ${cx} ${y + size * 0.3}
            C ${cx} ${y + size * 0.15} ${cx - scale * 0.3} ${y + size * 0.1} ${cx - scale * 0.4} ${y + size * 0.25}
            C ${cx - scale * 0.55} ${y + size * 0.45} ${cx} ${y + size * 0.7} ${cx} ${y + size * 0.85}
            C ${cx} ${y + size * 0.7} ${cx + scale * 0.55} ${y + size * 0.45} ${cx + scale * 0.4} ${y + size * 0.25}
            C ${cx + scale * 0.3} ${y + size * 0.1} ${cx} ${y + size * 0.15} ${cx} ${y + size * 0.3}
            Z
        `.trim().replace(/\s+/g, ' ');

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <path d="${heartPath}" fill="${color || '#E91E63'}"/>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Check/verified badge sticker
     */
    createCheckBadgeSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // Checkmark path
        const checkSize = size * 0.4;
        const checkX = cx - checkSize * 0.5;
        const checkY = cy - checkSize * 0.2;

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color || '#4CAF50'}"/>
                <path d="M ${checkX} ${checkY + checkSize * 0.5}
                         L ${checkX + checkSize * 0.35} ${checkY + checkSize * 0.85}
                         L ${checkX + checkSize} ${checkY + checkSize * 0.15}"
                      stroke="${textColor || '#FFFFFF'}"
                      stroke-width="${size * 0.08}"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      fill="none"/>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Info badge sticker
     */
    createInfoBadgeSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85;
        const fontSize = size * 0.5;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color || '#2196F3'}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Georgia, serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      font-style="italic"
                      fill="${textColor || '#FFFFFF'}"
                      text-anchor="middle">
                    i
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Gift badge sticker
     */
    createGiftBadgeSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const boxSize = size * 0.6;
        const ribbonWidth = size * 0.12;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const boxX = cx - boxSize / 2;
        const boxY = cy - boxSize / 2 + size * 0.1;

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <!-- Bow -->
                <ellipse cx="${cx - boxSize * 0.2}" cy="${boxY - size * 0.05}" rx="${size * 0.12}" ry="${size * 0.08}" fill="${textColor || '#FFFFFF'}"/>
                <ellipse cx="${cx + boxSize * 0.2}" cy="${boxY - size * 0.05}" rx="${size * 0.12}" ry="${size * 0.08}" fill="${textColor || '#FFFFFF'}"/>
                <!-- Box -->
                <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize * 0.85}" rx="${size * 0.05}" fill="${color || '#E91E63'}"/>
                <!-- Vertical ribbon -->
                <rect x="${cx - ribbonWidth / 2}" y="${boxY}" width="${ribbonWidth}" height="${boxSize * 0.85}" fill="${textColor || '#FFFFFF'}"/>
                <!-- Horizontal ribbon -->
                <rect x="${boxX}" y="${cy - ribbonWidth / 2 + size * 0.05}" width="${boxSize}" height="${ribbonWidth}" fill="${textColor || '#FFFFFF'}"/>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Location pin sticker
     */
    createLocationPinSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const pinWidth = size * 0.6;
        const pinHeight = size * 0.8;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // Location pin path
        const pinPath = `
            M ${cx} ${y + size * 0.1}
            C ${cx - pinWidth * 0.5} ${y + size * 0.1} ${cx - pinWidth * 0.5} ${y + size * 0.5} ${cx} ${y + size * 0.9}
            C ${cx + pinWidth * 0.5} ${y + size * 0.5} ${cx + pinWidth * 0.5} ${y + size * 0.1} ${cx} ${y + size * 0.1}
            Z
        `.trim().replace(/\s+/g, ' ');

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <path d="${pinPath}" fill="${color || '#F44336'}"/>
                <circle cx="${cx}" cy="${y + size * 0.35}" r="${size * 0.12}" fill="${textColor || '#FFFFFF'}"/>
            </g>
        `;

        return { element, defs };
    }

    /**
     * QR Details sticker
     */
    createQRDetailsSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85;
        const fontSize = size * 0.35;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color || '#333333'}"/>
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor || '#FFFFFF'}"
                      text-anchor="middle">
                    ${this.escapeXml(text || 'QR')}
                </text>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Pincode protected sticker (lock icon)
     */
    createPincodeSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const lockWidth = size * 0.5;
        const lockHeight = size * 0.4;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const lockX = cx - lockWidth / 2;
        const lockY = cy - lockHeight * 0.3;

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <!-- Lock shackle -->
                <path d="M ${cx - lockWidth * 0.3} ${lockY}
                         L ${cx - lockWidth * 0.3} ${lockY - lockHeight * 0.4}
                         A ${lockWidth * 0.3} ${lockWidth * 0.3} 0 0 1 ${cx + lockWidth * 0.3} ${lockY - lockHeight * 0.4}
                         L ${cx + lockWidth * 0.3} ${lockY}"
                      stroke="${color || '#FFB300'}"
                      stroke-width="${size * 0.08}"
                      stroke-linecap="round"
                      fill="none"/>
                <!-- Lock body -->
                <rect x="${lockX}" y="${lockY}" width="${lockWidth}" height="${lockHeight}" rx="${size * 0.05}" fill="${color || '#FFB300'}"/>
                <!-- Keyhole -->
                <circle cx="${cx}" cy="${lockY + lockHeight * 0.4}" r="${size * 0.06}" fill="${textColor || '#FFFFFF'}"/>
                <rect x="${cx - size * 0.03}" y="${lockY + lockHeight * 0.4}" width="${size * 0.06}" height="${lockHeight * 0.35}" fill="${textColor || '#FFFFFF'}"/>
            </g>
        `;

        return { element, defs };
    }

    /**
     * WiFi badge sticker
     */
    createWifiBadgeSticker(info, svgSize) {
        const { x, y, size, color, textColor, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        // WiFi arcs
        const arcOffset = size * 0.1;

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color || '#2196F3'}"/>
                <g transform="translate(${cx}, ${cy + size * 0.1})">
                    <path d="M 0 ${-size * 0.25} A ${size * 0.35} ${size * 0.35} 0 0 1 0 ${size * 0.05}"
                          stroke="${textColor || '#FFFFFF'}" stroke-width="${size * 0.06}" fill="none" stroke-linecap="round"/>
                    <path d="M 0 ${-size * 0.15} A ${size * 0.2} ${size * 0.2} 0 0 1 0 ${size * 0.05}"
                          stroke="${textColor || '#FFFFFF'}" stroke-width="${size * 0.06}" fill="none" stroke-linecap="round"/>
                    <circle cx="0" cy="${size * 0.12}" r="${size * 0.06}" fill="${textColor || '#FFFFFF'}"/>
                </g>
            </g>
        `;

        return { element, defs };
    }

    /**
     * Scan badge sticker
     */
    createScanBadgeSticker(info, svgSize) {
        const { x, y, size, color, textColor, text, dropShadow } = info;
        const cx = x + size / 2;
        const cy = y + size / 2;
        const boxSize = size * 0.75;
        const cornerSize = size * 0.2;
        const fontSize = size * 0.2;

        let defs = '';
        if (dropShadow) {
            defs = this.createDropShadowDef('stickerShadow');
        }

        const boxX = cx - boxSize / 2;
        const boxY = cy - boxSize / 2;

        const element = `
            <g ${dropShadow ? 'filter="url(#stickerShadow)"' : ''}>
                <!-- Background -->
                <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="${size * 0.05}" fill="${color || '#FFFFFF'}" fill-opacity="0.9"/>
                <!-- Corner brackets -->
                <path d="M ${boxX + size * 0.05} ${boxY + cornerSize} L ${boxX + size * 0.05} ${boxY + size * 0.05} L ${boxX + cornerSize} ${boxY + size * 0.05}"
                      stroke="${textColor || '#000000'}" stroke-width="${size * 0.04}" fill="none" stroke-linecap="round"/>
                <path d="M ${boxX + boxSize - cornerSize} ${boxY + size * 0.05} L ${boxX + boxSize - size * 0.05} ${boxY + size * 0.05} L ${boxX + boxSize - size * 0.05} ${boxY + cornerSize}"
                      stroke="${textColor || '#000000'}" stroke-width="${size * 0.04}" fill="none" stroke-linecap="round"/>
                <path d="M ${boxX + boxSize - size * 0.05} ${boxY + boxSize - cornerSize} L ${boxX + boxSize - size * 0.05} ${boxY + boxSize - size * 0.05} L ${boxX + boxSize - cornerSize} ${boxY + boxSize - size * 0.05}"
                      stroke="${textColor || '#000000'}" stroke-width="${size * 0.04}" fill="none" stroke-linecap="round"/>
                <path d="M ${boxX + cornerSize} ${boxY + boxSize - size * 0.05} L ${boxX + size * 0.05} ${boxY + boxSize - size * 0.05} L ${boxX + size * 0.05} ${boxY + boxSize - cornerSize}"
                      stroke="${textColor || '#000000'}" stroke-width="${size * 0.04}" fill="none" stroke-linecap="round"/>
                <!-- Text -->
                <text x="${cx}" y="${cy + fontSize * 0.35}"
                      font-family="Arial, sans-serif"
                      font-size="${fontSize}"
                      font-weight="bold"
                      fill="${textColor || '#000000'}"
                      text-anchor="middle">
                    ${this.escapeXml(text || 'SCAN')}
                </text>
            </g>
        `;

        return { element, defs };
    }

    // ========================================
    // Helper Methods
    // ========================================

    /**
     * Create drop shadow filter definition
     */
    createDropShadowDef(id) {
        return `
            <filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.4)"/>
            </filter>
        `;
    }

    /**
     * Escape XML special characters
     */
    escapeXml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Get list of supported sticker types
     */
    static getSupportedStickers() {
        return [
            'none',
            'coupon',
            'sale',
            'discount',
            'new',
            'hot',
            'star-badge',
            'heart-badge',
            'check-badge',
            'info-badge',
            'gift-badge',
            'location-pin',
            'qr-details',
            'pincode-protected',
            'wifi-badge',
            'scan-badge',
        ];
    }
}

module.exports = StickerProcessor;
