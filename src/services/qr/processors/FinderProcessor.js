/**
 * FinderProcessor - Handles QR code finder pattern shapes
 *
 * Sort Order: 8 (runs after ModuleProcessor)
 *
 * Finder patterns are the three large squares in corners of QR codes.
 * Each consists of:
 * - Outer ring (7x7 modules)
 * - Inner ring (5x5 modules, white/background)
 * - Center dot (3x3 modules)
 *
 * Supported finder shapes:
 * - square (default)
 * - circle / dot
 * - rounded / rounded-corners
 * - extra-rounded
 * - leaf
 * - diamond / rhombus
 * - eye-shaped
 * - octagon
 * - whirlpool
 * - water-drop
 * - zigzag
 * - circle-dots
 *
 * Supported finder dot shapes:
 * - square (default)
 * - circle / dot
 * - rounded / rounded-corners
 * - diamond / rhombus
 * - star
 * - heart
 * - eye-shaped
 * - octagon
 * - whirlpool
 * - water-drop
 * - zigzag
 */
const BaseProcessor = require('./BaseProcessor');

class FinderProcessor extends BaseProcessor {
    constructor() {
        super('FinderProcessor', 8);

        // Map of supported finder shapes
        this.finderShapes = {
            'square': this.createSquareFinder.bind(this),
            'default': this.createSquareFinder.bind(this),
            'circle': this.createCircleFinder.bind(this),
            'dot': this.createCircleFinder.bind(this),
            'rounded': this.createRoundedFinder.bind(this),
            'rounded-corners': this.createRoundedFinder.bind(this),
            'roundedCorners': this.createRoundedFinder.bind(this),
            'extra-rounded': this.createExtraRoundedFinder.bind(this),
            'extraRounded': this.createExtraRoundedFinder.bind(this),
            'leaf': this.createLeafFinder.bind(this),
            'diamond': this.createDiamondFinder.bind(this),
            'rhombus': this.createDiamondFinder.bind(this),
            // New shapes
            'eye-shaped': this.createEyeShapedFinder.bind(this),
            'eyeShaped': this.createEyeShapedFinder.bind(this),
            'octagon': this.createOctagonFinder.bind(this),
            'whirlpool': this.createWhirlpoolFinder.bind(this),
            'water-drop': this.createWaterDropFinder.bind(this),
            'waterDrop': this.createWaterDropFinder.bind(this),
            'zigzag': this.createZigzagFinder.bind(this),
            'circle-dots': this.createCircleDotsFinder.bind(this),
            'circleDots': this.createCircleDotsFinder.bind(this),
        };

        // Map of supported finder dot shapes
        this.dotShapes = {
            'square': this.createSquareDot.bind(this),
            'default': this.createSquareDot.bind(this),
            'circle': this.createCircleDot.bind(this),
            'dot': this.createCircleDot.bind(this),
            'rounded': this.createRoundedDot.bind(this),
            'rounded-corners': this.createRoundedDot.bind(this),
            'roundedCorners': this.createRoundedDot.bind(this),
            'diamond': this.createDiamondDot.bind(this),
            'rhombus': this.createDiamondDot.bind(this),
            'star': this.createStarDot.bind(this),
            'heart': this.createHeartDot.bind(this),
            // New shapes
            'eye-shaped': this.createEyeShapedDot.bind(this),
            'eyeShaped': this.createEyeShapedDot.bind(this),
            'octagon': this.createOctagonDot.bind(this),
            'whirlpool': this.createWhirlpoolDot.bind(this),
            'water-drop': this.createWaterDropDot.bind(this),
            'waterDrop': this.createWaterDropDot.bind(this),
            'zigzag': this.createZigzagDot.bind(this),
        };
    }

    /**
     * Check if this processor should process the payload
     * @param {Object} payload
     * @returns {boolean}
     */
    shouldProcess(payload) {
        return true; // Always process to handle finder patterns
    }

    /**
     * Process the payload to apply finder pattern shapes
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async process(payload) {
        const { design } = payload;

        // Get finder shape
        const finderShape = this.normalizeShape(
            design.finder || design.finderShape || design.eyeShape || 'square',
            this.finderShapes
        );

        // Get finder dot shape
        const finderDotShape = this.normalizeShape(
            design.finderDot || design.finderDotShape || design.eyeDotShape || finderShape,
            this.dotShapes
        );

        // Store in payload
        payload.finderShape = finderShape;
        payload.finderDotShape = finderDotShape;
        payload.finderPathGenerator = this.getFinderPathGenerator(finderShape);
        payload.finderDotPathGenerator = this.getDotPathGenerator(finderDotShape);

        this.log('Finder shape: ' + finderShape + ', dot shape: ' + finderDotShape);

        return payload;
    }

    /**
     * Normalize shape name
     */
    normalizeShape(shape, shapeMap) {
        if (!shape) return 'square';

        const normalized = shape.toLowerCase().replace(/_/g, '-');

        if (shapeMap[normalized]) {
            return normalized;
        }

        this.log('Unknown finder shape: ' + shape + ', falling back to square', 'warn');
        return 'square';
    }

    /**
     * Get finder path generator
     */
    getFinderPathGenerator(shape) {
        return this.finderShapes[shape] || this.finderShapes['square'];
    }

    /**
     * Get dot path generator
     */
    getDotPathGenerator(shape) {
        return this.dotShapes[shape] || this.dotShapes['square'];
    }

    /**
     * Generate complete finder pattern SVG elements
     * @param {string} finderShape
     * @param {string} dotShape
     * @param {number} x - Top-left X
     * @param {number} y - Top-left Y
     * @param {number} moduleSize
     * @param {Object} colors - { outer, inner, dot }
     * @returns {Object} - { outerPath, innerPath, dotPath }
     */
    generateFinderPattern(finderShape, dotShape, x, y, moduleSize, colors = {}) {
        const outerSize = moduleSize * 7;
        const innerSize = moduleSize * 5;
        const dotSize = moduleSize * 3;

        const innerOffset = moduleSize;
        const dotOffset = moduleSize * 2;

        return {
            outerPath: this.getFinderPathGenerator(finderShape)(x, y, outerSize),
            innerPath: this.getFinderPathGenerator(finderShape)(x + innerOffset, y + innerOffset, innerSize),
            dotPath: this.getDotPathGenerator(dotShape)(x + dotOffset, y + dotOffset, dotSize),
        };
    }

    // ========================================
    // Finder Shape Generators (Outer/Inner rings)
    // ========================================

    /**
     * Square finder pattern
     */
    createSquareFinder(x, y, size) {
        return 'M ' + x + ' ' + y + ' L ' + (x + size) + ' ' + y + ' L ' + (x + size) + ' ' + (y + size) + ' L ' + x + ' ' + (y + size) + ' Z';
    }

    /**
     * Circle finder pattern
     */
    createCircleFinder(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2;

        return 'M ' + (cx - r) + ' ' + cy + ' ' +
            'A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy + ' ' +
            'A ' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy;
    }

    /**
     * Rounded finder pattern
     */
    createRoundedFinder(x, y, size) {
        const r = size * 0.2;
        return this.createRoundedRect(x, y, size, size, r);
    }

    /**
     * Extra rounded finder pattern
     */
    createExtraRoundedFinder(x, y, size) {
        const r = size * 0.35;
        return this.createRoundedRect(x, y, size, size, r);
    }

    /**
     * Leaf finder pattern (rounded on opposite corners)
     */
    createLeafFinder(x, y, size) {
        const r = size * 0.4;

        // Rounded on top-left and bottom-right only
        return this.createSelectiveRoundedRect(x, y, size, size, r, {
            topLeft: true,
            topRight: false,
            bottomRight: true,
            bottomLeft: false,
        });
    }

    /**
     * Diamond finder pattern
     */
    createDiamondFinder(x, y, size) {
        const half = size / 2;
        const cx = x + half;
        const cy = y + half;

        return 'M ' + cx + ' ' + y + ' ' +
            'L ' + (x + size) + ' ' + cy + ' ' +
            'L ' + cx + ' ' + (y + size) + ' ' +
            'L ' + x + ' ' + cy + ' Z';
    }

    /**
     * Eye-shaped finder pattern (pointed oval/almond shape)
     */
    createEyeShapedFinder(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const rx = size / 2;
        const ry = size / 3;

        // Almond/eye shape using bezier curves
        return `M ${x} ${cy} ` +
            `Q ${cx} ${y} ${x + size} ${cy} ` +
            `Q ${cx} ${y + size} ${x} ${cy} Z`;
    }

    /**
     * Octagon finder pattern
     */
    createOctagonFinder(x, y, size) {
        const cut = size * 0.3; // Corner cut amount

        return `M ${x + cut} ${y} ` +
            `L ${x + size - cut} ${y} ` +
            `L ${x + size} ${y + cut} ` +
            `L ${x + size} ${y + size - cut} ` +
            `L ${x + size - cut} ${y + size} ` +
            `L ${x + cut} ${y + size} ` +
            `L ${x} ${y + size - cut} ` +
            `L ${x} ${y + cut} Z`;
    }

    /**
     * Whirlpool finder pattern (spiral-like rounded shape)
     */
    createWhirlpoolFinder(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2;
        const offset = size * 0.15; // Spiral offset

        // Create a swirl effect with offset arcs
        return `M ${cx - r + offset} ${cy - offset} ` +
            `A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx + offset} ${cy - r + offset} ` +
            `A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx + r - offset} ${cy + offset} ` +
            `A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx - offset} ${cy + r - offset} ` +
            `A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx - r + offset} ${cy - offset} Z`;
    }

    /**
     * Water-drop finder pattern (teardrop shape)
     */
    createWaterDropFinder(x, y, size) {
        const cx = x + size / 2;
        const bottom = y + size;
        const r = size * 0.4;

        // Teardrop: pointed at top, rounded at bottom
        return `M ${cx} ${y} ` +
            `Q ${x + size} ${y + size * 0.5} ${x + size * 0.85} ${y + size * 0.7} ` +
            `A ${r} ${r} 0 1 1 ${x + size * 0.15} ${y + size * 0.7} ` +
            `Q ${x} ${y + size * 0.5} ${cx} ${y} Z`;
    }

    /**
     * Zigzag finder pattern (square with zigzag edges)
     */
    createZigzagFinder(x, y, size) {
        const zigSize = size / 6; // Size of each zig
        let path = `M ${x} ${y} `;

        // Top edge zigzag
        for (let i = 0; i < 3; i++) {
            const baseX = x + (i * 2 * zigSize);
            path += `L ${baseX + zigSize} ${y + zigSize} L ${baseX + 2 * zigSize} ${y} `;
        }

        // Right edge zigzag
        for (let i = 0; i < 3; i++) {
            const baseY = y + (i * 2 * zigSize);
            path += `L ${x + size - zigSize} ${baseY + zigSize} L ${x + size} ${baseY + 2 * zigSize} `;
        }

        // Bottom edge zigzag (reverse)
        for (let i = 2; i >= 0; i--) {
            const baseX = x + (i * 2 * zigSize);
            path += `L ${baseX + zigSize} ${y + size - zigSize} L ${baseX} ${y + size} `;
        }

        // Left edge zigzag (reverse)
        for (let i = 2; i >= 0; i--) {
            const baseY = y + (i * 2 * zigSize);
            path += `L ${x + zigSize} ${baseY + zigSize} L ${x} ${baseY} `;
        }

        return path + 'Z';
    }

    /**
     * Circle-dots finder pattern (circle made of small dots)
     */
    createCircleDotsFinder(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const mainR = size / 2 * 0.85;
        const dotR = size * 0.08;
        const numDots = 12;

        let path = '';
        for (let i = 0; i < numDots; i++) {
            const angle = (i * 2 * Math.PI / numDots) - Math.PI / 2;
            const dotX = cx + mainR * Math.cos(angle);
            const dotY = cy + mainR * Math.sin(angle);

            // Each dot is a small circle
            path += `M ${dotX - dotR} ${dotY} ` +
                `A ${dotR} ${dotR} 0 1 1 ${dotX + dotR} ${dotY} ` +
                `A ${dotR} ${dotR} 0 1 1 ${dotX - dotR} ${dotY} `;
        }

        return path;
    }

    // ========================================
    // Finder Dot Shape Generators (Center)
    // ========================================

    /**
     * Square dot
     */
    createSquareDot(x, y, size) {
        return 'M ' + x + ' ' + y + ' L ' + (x + size) + ' ' + y + ' L ' + (x + size) + ' ' + (y + size) + ' L ' + x + ' ' + (y + size) + ' Z';
    }

    /**
     * Circle dot
     */
    createCircleDot(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.9;

        return 'M ' + (cx - r) + ' ' + cy + ' ' +
            'A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy + ' ' +
            'A ' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy;
    }

    /**
     * Rounded dot
     */
    createRoundedDot(x, y, size) {
        const r = size * 0.25;
        return this.createRoundedRect(x, y, size, size, r);
    }

    /**
     * Diamond dot
     */
    createDiamondDot(x, y, size) {
        const half = size / 2;
        const cx = x + half;
        const cy = y + half;

        return 'M ' + cx + ' ' + y + ' ' +
            'L ' + (x + size) + ' ' + cy + ' ' +
            'L ' + cx + ' ' + (y + size) + ' ' +
            'L ' + x + ' ' + cy + ' Z';
    }

    /**
     * Star dot
     */
    createStarDot(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const outerR = size / 2 * 0.9;
        const innerR = outerR * 0.4;
        const points = 5;

        let path = '';
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);

            if (i === 0) {
                path = 'M ' + px + ' ' + py;
            } else {
                path += ' L ' + px + ' ' + py;
            }
        }
        path += ' Z';

        return path;
    }

    /**
     * Heart dot
     */
    createHeartDot(x, y, size) {
        const cx = x + size / 2;

        const heartPath = 'M ' + cx + ' ' + (y + size * 0.25) + ' ' +
            'C ' + cx + ' ' + (y + size * 0.15) + ' ' + (cx - size * 0.25) + ' ' + (y + size * 0.05) + ' ' + (cx - size * 0.35) + ' ' + (y + size * 0.2) + ' ' +
            'C ' + (cx - size * 0.5) + ' ' + (y + size * 0.4) + ' ' + cx + ' ' + (y + size * 0.65) + ' ' + cx + ' ' + (y + size * 0.85) + ' ' +
            'C ' + cx + ' ' + (y + size * 0.65) + ' ' + (cx + size * 0.5) + ' ' + (y + size * 0.4) + ' ' + (cx + size * 0.35) + ' ' + (y + size * 0.2) + ' ' +
            'C ' + (cx + size * 0.25) + ' ' + (y + size * 0.05) + ' ' + cx + ' ' + (y + size * 0.15) + ' ' + cx + ' ' + (y + size * 0.25) + ' Z';

        return heartPath;
    }

    /**
     * Eye-shaped dot (pointed oval/almond)
     */
    createEyeShapedDot(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;

        return `M ${x} ${cy} ` +
            `Q ${cx} ${y} ${x + size} ${cy} ` +
            `Q ${cx} ${y + size} ${x} ${cy} Z`;
    }

    /**
     * Octagon dot
     */
    createOctagonDot(x, y, size) {
        const cut = size * 0.3;

        return `M ${x + cut} ${y} ` +
            `L ${x + size - cut} ${y} ` +
            `L ${x + size} ${y + cut} ` +
            `L ${x + size} ${y + size - cut} ` +
            `L ${x + size - cut} ${y + size} ` +
            `L ${x + cut} ${y + size} ` +
            `L ${x} ${y + size - cut} ` +
            `L ${x} ${y + cut} Z`;
    }

    /**
     * Whirlpool dot (spiral-like)
     */
    createWhirlpoolDot(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.9;
        const offset = size * 0.1;

        return `M ${cx - r + offset} ${cy - offset} ` +
            `A ${r * 0.85} ${r * 0.85} 0 0 1 ${cx + offset} ${cy - r + offset} ` +
            `A ${r * 0.85} ${r * 0.85} 0 0 1 ${cx + r - offset} ${cy + offset} ` +
            `A ${r * 0.85} ${r * 0.85} 0 0 1 ${cx - offset} ${cy + r - offset} ` +
            `A ${r * 0.85} ${r * 0.85} 0 0 1 ${cx - r + offset} ${cy - offset} Z`;
    }

    /**
     * Water-drop dot (teardrop)
     */
    createWaterDropDot(x, y, size) {
        const cx = x + size / 2;
        const r = size * 0.35;

        return `M ${cx} ${y + size * 0.1} ` +
            `Q ${x + size * 0.9} ${y + size * 0.5} ${x + size * 0.8} ${y + size * 0.65} ` +
            `A ${r} ${r} 0 1 1 ${x + size * 0.2} ${y + size * 0.65} ` +
            `Q ${x + size * 0.1} ${y + size * 0.5} ${cx} ${y + size * 0.1} Z`;
    }

    /**
     * Zigzag dot (smaller zigzag pattern)
     */
    createZigzagDot(x, y, size) {
        const zigSize = size / 4;

        return `M ${x} ${y} ` +
            `L ${x + zigSize} ${y + zigSize} L ${x + 2 * zigSize} ${y} L ${x + 3 * zigSize} ${y + zigSize} L ${x + size} ${y} ` +
            `L ${x + size - zigSize} ${y + zigSize} L ${x + size} ${y + 2 * zigSize} L ${x + size - zigSize} ${y + 3 * zigSize} L ${x + size} ${y + size} ` +
            `L ${x + 3 * zigSize} ${y + size - zigSize} L ${x + 2 * zigSize} ${y + size} L ${x + zigSize} ${y + size - zigSize} L ${x} ${y + size} ` +
            `L ${x + zigSize} ${y + 3 * zigSize} L ${x} ${y + 2 * zigSize} L ${x + zigSize} ${y + zigSize} Z`;
    }

    // ========================================
    // Helper Methods
    // ========================================

    /**
     * Create a rounded rectangle path
     */
    createRoundedRect(x, y, width, height, r) {
        r = Math.min(r, width / 2, height / 2);

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
     * Create a rounded rectangle with selective corners
     */
    createSelectiveRoundedRect(x, y, width, height, r, corners = {}) {
        const { topLeft = true, topRight = true, bottomRight = true, bottomLeft = true } = corners;
        r = Math.min(r, width / 2, height / 2);

        let path = '';

        // Top-left corner
        if (topLeft) {
            path += 'M ' + (x + r) + ' ' + y + ' ';
        } else {
            path += 'M ' + x + ' ' + y + ' ';
        }

        // Top edge and top-right corner
        if (topRight) {
            path += 'L ' + (x + width - r) + ' ' + y + ' Q ' + (x + width) + ' ' + y + ' ' + (x + width) + ' ' + (y + r) + ' ';
        } else {
            path += 'L ' + (x + width) + ' ' + y + ' ';
        }

        // Right edge and bottom-right corner
        if (bottomRight) {
            path += 'L ' + (x + width) + ' ' + (y + height - r) + ' Q ' + (x + width) + ' ' + (y + height) + ' ' + (x + width - r) + ' ' + (y + height) + ' ';
        } else {
            path += 'L ' + (x + width) + ' ' + (y + height) + ' ';
        }

        // Bottom edge and bottom-left corner
        if (bottomLeft) {
            path += 'L ' + (x + r) + ' ' + (y + height) + ' Q ' + x + ' ' + (y + height) + ' ' + x + ' ' + (y + height - r) + ' ';
        } else {
            path += 'L ' + x + ' ' + (y + height) + ' ';
        }

        // Left edge and back to top-left
        if (topLeft) {
            path += 'L ' + x + ' ' + (y + r) + ' Q ' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' ';
        } else {
            path += 'L ' + x + ' ' + y + ' ';
        }

        path += 'Z';
        return path;
    }

    /**
     * Get finder pattern positions for a QR matrix
     * @param {number} matrixSize
     * @returns {Array} - Array of {row, col} for each finder pattern's top-left corner
     */
    static getFinderPositions(matrixSize) {
        return [
            { row: 0, col: 0 },                           // Top-left
            { row: 0, col: matrixSize - 7 },              // Top-right
            { row: matrixSize - 7, col: 0 },              // Bottom-left
        ];
    }

    /**
     * Check if a position is within a finder pattern
     * @param {number} row
     * @param {number} col
     * @param {number} matrixSize
     * @returns {boolean}
     */
    static isFinderPosition(row, col, matrixSize) {
        // Top-left finder
        if (row < 7 && col < 7) return true;
        // Top-right finder
        if (row < 7 && col >= matrixSize - 7) return true;
        // Bottom-left finder
        if (row >= matrixSize - 7 && col < 7) return true;

        return false;
    }

    /**
     * Get list of supported finder shapes
     */
    static getSupportedFinderShapes() {
        return [
            'square',
            'default',
            'circle',
            'dot',
            'rounded',
            'rounded-corners',
            'extra-rounded',
            'leaf',
            'diamond',
            'rhombus',
            'eye-shaped',
            'octagon',
            'whirlpool',
            'water-drop',
            'zigzag',
            'circle-dots',
        ];
    }

    /**
     * Get list of supported finder dot shapes
     */
    static getSupportedDotShapes() {
        return [
            'square',
            'default',
            'circle',
            'dot',
            'rounded',
            'rounded-corners',
            'diamond',
            'rhombus',
            'star',
            'heart',
            'eye-shaped',
            'octagon',
            'whirlpool',
            'water-drop',
            'zigzag',
        ];
    }
}

module.exports = FinderProcessor;
