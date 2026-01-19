/**
 * ModuleProcessor - Handles QR code module shapes
 *
 * Sort Order: 7 (runs after ColorProcessor)
 *
 * Supported shapes:
 * - square (default)
 * - dots / circle
 * - rounded
 * - extra-rounded
 * - rhombus / diamond
 * - vertical / vertical-line / vertical-lines
 * - horizontal / horizontal-line / horizontal-lines
 * - classy
 * - classy-rounded
 * - star / star-5
 * - star-7
 * - heart
 * - triangle
 * - triangle-end
 * - fish
 * - tree
 * - roundness
 * - twoTrianglesWithCircle
 * - fourTriangles
 */
const BaseProcessor = require('./BaseProcessor');

class ModuleProcessor extends BaseProcessor {
    constructor() {
        super('ModuleProcessor', 7);

        // Map of supported module shapes
        this.shapes = {
            'square': this.createSquare.bind(this),
            'dots': this.createDot.bind(this),
            'dot': this.createDot.bind(this),
            'circle': this.createDot.bind(this),
            'rounded': this.createRounded.bind(this),
            'extra-rounded': this.createExtraRounded.bind(this),
            'extraRounded': this.createExtraRounded.bind(this),
            'rhombus': this.createRhombus.bind(this),
            'diamond': this.createRhombus.bind(this),
            'vertical': this.createVerticalLine.bind(this),
            'vertical-line': this.createVerticalLine.bind(this),
            'vertical-lines': this.createVerticalLine.bind(this),
            'verticalLine': this.createVerticalLine.bind(this),
            'horizontal': this.createHorizontalLine.bind(this),
            'horizontal-line': this.createHorizontalLine.bind(this),
            'horizontal-lines': this.createHorizontalLine.bind(this),
            'horizontalLine': this.createHorizontalLine.bind(this),
            'classy': this.createClassy.bind(this),
            'classy-rounded': this.createClassyRounded.bind(this),
            'classyRounded': this.createClassyRounded.bind(this),
            'star': this.createStar.bind(this),
            'star-5': this.createStar.bind(this),
            'star-7': this.createStar7.bind(this),
            'heart': this.createHeart.bind(this),
            // New shapes
            'triangle': this.createTriangle.bind(this),
            'triangle-end': this.createTriangleEnd.bind(this),
            'triangleEnd': this.createTriangleEnd.bind(this),
            'triangleend': this.createTriangleEnd.bind(this),
            'fish': this.createFish.bind(this),
            'tree': this.createTree.bind(this),
            'roundness': this.createRoundness.bind(this),
            // Two triangles with circle (all variations)
            'twoTrianglesWithCircle': this.createTwoTrianglesWithCircle.bind(this),
            'twotriangleswithcircle': this.createTwoTrianglesWithCircle.bind(this),
            'two-triangles-with-circle': this.createTwoTrianglesWithCircle.bind(this),
            // Four triangles (all variations)
            'fourTriangles': this.createFourTriangles.bind(this),
            'fourtriangles': this.createFourTriangles.bind(this),
            'four-triangles': this.createFourTriangles.bind(this),
            '4-triangles': this.createFourTriangles.bind(this),
        };
    }

    /**
     * Check if this processor should process the payload
     * @param {Object} payload
     * @returns {boolean}
     */
    shouldProcess(payload) {
        return true; // Always process to handle module rendering
    }

    /**
     * Process the payload to apply module shapes
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async process(payload) {
        const { design, qrMatrix, moduleSize, startX, startY } = payload;

        console.log(`[ModuleProcessor] process called with design.module: ${design.module}, design.moduleShape: ${design.moduleShape}`);

        // Get module shape
        const shape = this.normalizeShape(design.module || design.moduleShape || 'square');

        // Store shape info in payload for BuildSVG to use
        payload.moduleShape = shape;
        payload.modulePathGenerator = this.getPathGenerator(shape);

        console.log(`[ModuleProcessor] Final module shape: ${shape}, generator exists: ${!!payload.modulePathGenerator}`);
        this.log(`Module shape set to: ${shape}`);

        return payload;
    }

    /**
     * Normalize shape name to a standard format
     * @param {string} shape
     * @returns {string}
     */
    normalizeShape(shape) {
        if (!shape) return 'square';

        const normalized = shape.toLowerCase().replace(/_/g, '-');

        // Check if shape is supported
        if (this.shapes[normalized]) {
            this.log(`Module shape resolved: ${shape} → ${normalized}`);
            return normalized;
        }

        // Try original value as fallback (for camelCase values already in map)
        if (this.shapes[shape]) {
            this.log(`Module shape resolved (direct match): ${shape}`);
            return shape;
        }

        this.log(`Unknown module shape: ${shape} (normalized: ${normalized}), falling back to square`, 'warn');
        return 'square';
    }

    /**
     * Get the path generator function for a shape
     * @param {string} shape
     * @returns {Function}
     */
    getPathGenerator(shape) {
        return this.shapes[shape] || this.shapes['square'];
    }

    /**
     * Generate path data for a module at given position
     * @param {string} shape - Shape name
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Module size
     * @param {Object} context - Context with neighbor info
     * @returns {string} - SVG path data
     */
    generateModulePath(shape, x, y, size, context = {}) {
        const generator = this.getPathGenerator(shape);
        if (!generator) {
            console.error(`[ModuleProcessor] No generator found for shape: ${shape}, falling back to square`);
            return this.createSquare(x, y, size, context);
        }
        return generator(x, y, size, context);
    }

    // ========================================
    // Shape Generators
    // ========================================

    /**
     * Square module (default)
     */
    createSquare(x, y, size, context = {}) {
        return `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size} L ${x} ${y + size} Z`;
    }

    /**
     * Circular dot module
     */
    createDot(x, y, size, context = {}) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 * 0.85; // Slightly smaller for visual separation

        // Circle using arc commands
        return `M ${cx - r} ${cy} ` +
            `A ${r} ${r} 0 1 1 ${cx + r} ${cy} ` +
            `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
    }

    /**
     * Rounded square module
     */
    createRounded(x, y, size, context = {}) {
        const r = size * 0.25; // Corner radius
        return this.createRoundedRect(x, y, size, size, r);
    }

    /**
     * Extra rounded module (almost circular)
     */
    createExtraRounded(x, y, size, context = {}) {
        const r = size * 0.4; // Larger corner radius
        return this.createRoundedRect(x, y, size, size, r);
    }

    /**
     * Rhombus/Diamond module
     */
    createRhombus(x, y, size, context = {}) {
        const half = size / 2;
        const cx = x + half;
        const cy = y + half;

        return `M ${cx} ${y} ` +
            `L ${x + size} ${cy} ` +
            `L ${cx} ${y + size} ` +
            `L ${x} ${cy} Z`;
    }

    /**
     * Vertical line module
     */
    createVerticalLine(x, y, size, context = {}) {
        const width = size * 0.35;
        const offset = (size - width) / 2;

        return `M ${x + offset} ${y} ` +
            `L ${x + offset + width} ${y} ` +
            `L ${x + offset + width} ${y + size} ` +
            `L ${x + offset} ${y + size} Z`;
    }

    /**
     * Horizontal line module
     */
    createHorizontalLine(x, y, size, context = {}) {
        const height = size * 0.35;
        const offset = (size - height) / 2;

        return `M ${x} ${y + offset} ` +
            `L ${x + size} ${y + offset} ` +
            `L ${x + size} ${y + offset + height} ` +
            `L ${x} ${y + offset + height} Z`;
    }

    /**
     * Classy module - connected dots with neighbors
     * Creates smooth connections between adjacent modules
     */
    createClassy(x, y, size, context = {}) {
        const { hasTop, hasRight, hasBottom, hasLeft } = context;
        const half = size / 2;
        const quarter = size / 4;

        // Base is a small square in the center
        let path = '';

        // Center piece
        const cx = x + quarter;
        const cy = y + quarter;
        const innerSize = half;

        path = `M ${cx} ${cy} L ${cx + innerSize} ${cy} L ${cx + innerSize} ${cy + innerSize} L ${cx} ${cy + innerSize} Z`;

        // Extend to neighbors
        if (hasTop) {
            path += ` M ${x + quarter} ${y} L ${x + quarter + half} ${y} L ${x + quarter + half} ${y + quarter} L ${x + quarter} ${y + quarter} Z`;
        }
        if (hasRight) {
            path += ` M ${x + quarter + half} ${y + quarter} L ${x + size} ${y + quarter} L ${x + size} ${y + quarter + half} L ${x + quarter + half} ${y + quarter + half} Z`;
        }
        if (hasBottom) {
            path += ` M ${x + quarter} ${y + quarter + half} L ${x + quarter + half} ${y + quarter + half} L ${x + quarter + half} ${y + size} L ${x + quarter} ${y + size} Z`;
        }
        if (hasLeft) {
            path += ` M ${x} ${y + quarter} L ${x + quarter} ${y + quarter} L ${x + quarter} ${y + quarter + half} L ${x} ${y + quarter + half} Z`;
        }

        return path || this.createSquare(x, y, size, context);
    }

    /**
     * Classy rounded - like classy but with rounded corners
     */
    createClassyRounded(x, y, size, context = {}) {
        const { hasTop, hasRight, hasBottom, hasLeft } = context;
        const r = size * 0.15;

        // Determine which corners should be rounded based on neighbors
        const roundTopLeft = !hasTop && !hasLeft;
        const roundTopRight = !hasTop && !hasRight;
        const roundBottomRight = !hasBottom && !hasRight;
        const roundBottomLeft = !hasBottom && !hasLeft;

        return this.createSelectiveRoundedRect(x, y, size, size, r, {
            topLeft: roundTopLeft,
            topRight: roundTopRight,
            bottomRight: roundBottomRight,
            bottomLeft: roundBottomLeft,
        });
    }

    /**
     * Star-shaped module
     */
    createStar(x, y, size, context = {}) {
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
                path = `M ${px} ${py}`;
            } else {
                path += ` L ${px} ${py}`;
            }
        }
        path += ' Z';

        return path;
    }

    /**
     * Heart-shaped module
     */
    createHeart(x, y, size, context = {}) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const scale = size / 20; // Base heart is 20x20

        // Heart shape path scaled and translated
        const heartPath = `
            M ${cx} ${y + size * 0.25}
            C ${cx} ${y + size * 0.15} ${cx - size * 0.25} ${y + size * 0.05} ${cx - size * 0.35} ${y + size * 0.2}
            C ${cx - size * 0.5} ${y + size * 0.4} ${cx} ${y + size * 0.65} ${cx} ${y + size * 0.85}
            C ${cx} ${y + size * 0.65} ${cx + size * 0.5} ${y + size * 0.4} ${cx + size * 0.35} ${y + size * 0.2}
            C ${cx + size * 0.25} ${y + size * 0.05} ${cx} ${y + size * 0.15} ${cx} ${y + size * 0.25}
            Z
        `.trim().replace(/\s+/g, ' ');

        return heartPath;
    }

    /**
     * 7-pointed star module
     */
    createStar7(x, y, size, context = {}) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const outerR = size / 2 * 0.9;
        const innerR = outerR * 0.45;
        const points = 7;

        let path = '';
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);

            if (i === 0) {
                path = `M ${px} ${py}`;
            } else {
                path += ` L ${px} ${py}`;
            }
        }
        path += ' Z';

        return path;
    }

    /**
     * Triangle module (pointing up)
     */
    createTriangle(x, y, size, context = {}) {
        const cx = x + size / 2;
        const padding = size * 0.1;

        return `M ${cx} ${y + padding} ` +
            `L ${x + size - padding} ${y + size - padding} ` +
            `L ${x + padding} ${y + size - padding} Z`;
    }

    /**
     * Triangle-end module (pointing right, like an arrow/chevron)
     */
    createTriangleEnd(x, y, size, context = {}) {
        console.log(`[ModuleProcessor] createTriangleEnd called: x=${x}, y=${y}, size=${size}`);
        const pad = size * 0.05;
        const cy = y + size / 2;

        // Arrow pointing right - clear chevron shape
        const path = `M ${x + pad} ${y + pad} ` +
            `L ${x + size - pad} ${cy} ` +
            `L ${x + pad} ${y + size - pad} Z`;
        console.log(`[ModuleProcessor] createTriangleEnd path: ${path}`);
        return path;
    }

    /**
     * Fish-shaped module
     */
    createFish(x, y, size, context = {}) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const bodyWidth = size * 0.7;
        const bodyHeight = size * 0.5;

        // Fish body (ellipse) with tail
        const fishPath = `
            M ${x + size * 0.15} ${cy}
            Q ${x + size * 0.15} ${y + size * 0.25} ${cx} ${y + size * 0.25}
            Q ${x + size * 0.75} ${y + size * 0.25} ${x + size * 0.75} ${cy}
            L ${x + size * 0.95} ${y + size * 0.3}
            L ${x + size * 0.95} ${y + size * 0.7}
            L ${x + size * 0.75} ${cy}
            Q ${x + size * 0.75} ${y + size * 0.75} ${cx} ${y + size * 0.75}
            Q ${x + size * 0.15} ${y + size * 0.75} ${x + size * 0.15} ${cy}
            Z
        `.trim().replace(/\s+/g, ' ');

        return fishPath;
    }

    /**
     * Tree-shaped module (simple pine tree)
     */
    createTree(x, y, size, context = {}) {
        const cx = x + size / 2;
        const trunkWidth = size * 0.2;
        const trunkHeight = size * 0.25;

        // Tree with triangular top and rectangular trunk
        const treePath = `
            M ${cx} ${y + size * 0.05}
            L ${x + size * 0.85} ${y + size * 0.65}
            L ${x + size * 0.6} ${y + size * 0.65}
            L ${x + size * 0.6} ${y + size * 0.95}
            L ${x + size * 0.4} ${y + size * 0.95}
            L ${x + size * 0.4} ${y + size * 0.65}
            L ${x + size * 0.15} ${y + size * 0.65}
            Z
        `.trim().replace(/\s+/g, ' ');

        return treePath;
    }

    /**
     * Roundness module (very rounded square, almost pill-shaped)
     */
    createRoundness(x, y, size, context = {}) {
        console.log(`[ModuleProcessor] createRoundness called: x=${x}, y=${y}, size=${size}`);
        // Create an almost-circular rounded rectangle
        const padding = size * 0.05;
        const innerSize = size - padding * 2;
        const r = innerSize * 0.48; // Almost circular
        const path = this.createRoundedRect(x + padding, y + padding, innerSize, innerSize, r);
        console.log(`[ModuleProcessor] createRoundness path: ${path.substring(0, 50)}...`);
        return path;
    }

    /**
     * Two triangles with circle module
     * Top triangle pointing down, bottom triangle pointing up, with circle in center
     */
    createTwoTrianglesWithCircle(x, y, size, context = {}) {
        console.log(`[ModuleProcessor] createTwoTrianglesWithCircle called: x=${x}, y=${y}, size=${size}`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const pad = size * 0.05;

        // Circle in center - make it more visible
        const circleR = size * 0.18;
        const circle = `M ${cx - circleR} ${cy} A ${circleR} ${circleR} 0 1 1 ${cx + circleR} ${cy} A ${circleR} ${circleR} 0 1 1 ${cx - circleR} ${cy}`;

        // Top triangle - pointing DOWN toward circle (apex near circle, base at top)
        const topTriangle = `M ${x + pad} ${y + pad} L ${x + size - pad} ${y + pad} L ${cx} ${cy - circleR - pad * 2} Z`;

        // Bottom triangle - pointing UP toward circle (apex near circle, base at bottom)
        const bottomTriangle = `M ${x + pad} ${y + size - pad} L ${x + size - pad} ${y + size - pad} L ${cx} ${cy + circleR + pad * 2} Z`;

        const path = `${circle} ${topTriangle} ${bottomTriangle}`;
        console.log(`[ModuleProcessor] createTwoTrianglesWithCircle generated path`);
        return path;
    }

    /**
     * Four triangles module - pinwheel/windmill style with visible gaps
     * Four separate triangles pointing inward from corners with gaps between them
     */
    createFourTriangles(x, y, size, context = {}) {
        console.log(`[ModuleProcessor] createFourTriangles called: x=${x}, y=${y}, size=${size}`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const gap = size * 0.12; // Gap between triangles for visual distinction

        // Four triangles from corners pointing toward center (with gap)
        // Top-left triangle
        const tl = `M ${x} ${y} L ${cx - gap} ${y} L ${x} ${cy - gap} Z`;

        // Top-right triangle
        const tr = `M ${x + size} ${y} L ${x + size} ${cy - gap} L ${cx + gap} ${y} Z`;

        // Bottom-right triangle
        const br = `M ${x + size} ${y + size} L ${cx + gap} ${y + size} L ${x + size} ${cy + gap} Z`;

        // Bottom-left triangle
        const bl = `M ${x} ${y + size} L ${x} ${cy + gap} L ${cx - gap} ${y + size} Z`;

        const path = `${tl} ${tr} ${br} ${bl}`;
        console.log(`[ModuleProcessor] createFourTriangles generated 4 corner triangles`);
        return path;
    }

    // ========================================
    // Helper Methods
    // ========================================

    /**
     * Create a rounded rectangle path
     */
    createRoundedRect(x, y, width, height, r) {
        r = Math.min(r, width / 2, height / 2);

        return `M ${x + r} ${y} ` +
            `L ${x + width - r} ${y} ` +
            `Q ${x + width} ${y} ${x + width} ${y + r} ` +
            `L ${x + width} ${y + height - r} ` +
            `Q ${x + width} ${y + height} ${x + width - r} ${y + height} ` +
            `L ${x + r} ${y + height} ` +
            `Q ${x} ${y + height} ${x} ${y + height - r} ` +
            `L ${x} ${y + r} ` +
            `Q ${x} ${y} ${x + r} ${y} Z`;
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
            path += `M ${x + r} ${y} `;
        } else {
            path += `M ${x} ${y} `;
        }

        // Top edge and top-right corner
        if (topRight) {
            path += `L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} `;
        } else {
            path += `L ${x + width} ${y} `;
        }

        // Right edge and bottom-right corner
        if (bottomRight) {
            path += `L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} `;
        } else {
            path += `L ${x + width} ${y + height} `;
        }

        // Bottom edge and bottom-left corner
        if (bottomLeft) {
            path += `L ${x + r} ${y + height} Q ${x} ${y + height} ${x} ${y + height - r} `;
        } else {
            path += `L ${x} ${y + height} `;
        }

        // Left edge and back to top-left
        if (topLeft) {
            path += `L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} `;
        } else {
            path += `L ${x} ${y} `;
        }

        path += 'Z';
        return path;
    }

    /**
     * Get neighbor information for a module
     * @param {Array} matrix - QR matrix
     * @param {number} row
     * @param {number} col
     * @param {number} size - Matrix size
     * @returns {Object}
     */
    static getNeighborContext(matrix, row, col, size) {
        return {
            hasTop: row > 0 && matrix[row - 1][col] === 1,
            hasRight: col < size - 1 && matrix[row][col + 1] === 1,
            hasBottom: row < size - 1 && matrix[row + 1][col] === 1,
            hasLeft: col > 0 && matrix[row][col - 1] === 1,
            hasTopLeft: row > 0 && col > 0 && matrix[row - 1][col - 1] === 1,
            hasTopRight: row > 0 && col < size - 1 && matrix[row - 1][col + 1] === 1,
            hasBottomRight: row < size - 1 && col < size - 1 && matrix[row + 1][col + 1] === 1,
            hasBottomLeft: row < size - 1 && col > 0 && matrix[row + 1][col - 1] === 1,
        };
    }

    /**
     * Get list of supported shapes
     * @returns {string[]}
     */
    static getSupportedShapes() {
        return [
            'square',
            'dots',
            'circle',
            'rounded',
            'extra-rounded',
            'rhombus',
            'diamond',
            'vertical',
            'vertical-lines',
            'horizontal',
            'horizontal-lines',
            'classy',
            'classy-rounded',
            'star',
            'star-5',
            'star-7',
            'heart',
            'triangle',
            'triangle-end',
            'fish',
            'tree',
            'roundness',
            'twoTrianglesWithCircle',
            'fourTriangles',
        ];
    }
}

module.exports = ModuleProcessor;
