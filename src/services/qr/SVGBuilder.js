/**
 * SVGBuilder - Builds and manipulates SVG documents for QR codes
 *
 * This class provides a fluent interface for creating SVG documents
 * with support for gradients, paths, and other SVG elements.
 */
class SVGBuilder {
    /**
     * Create a new SVGBuilder instance
     * @param {number} width - SVG width
     * @param {number} height - SVG height
     * @param {Object} options - Additional options
     */
    constructor(width = 300, height = 300, options = {}) {
        this.width = width;
        this.height = height;
        this.options = options;

        // SVG elements storage
        this.defs = [];
        this.elements = [];
        this.gradientCounter = 0;
        this.filterCounter = 0;

        // Namespace
        this.xmlns = 'http://www.w3.org/2000/svg';
    }

    /**
     * Create an SVGBuilder from a size value
     * @param {number} size - Size for both width and height
     * @returns {SVGBuilder}
     */
    static create(size) {
        return new SVGBuilder(size, size);
    }

    /**
     * Set the viewBox
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - ViewBox width
     * @param {number} height - ViewBox height
     * @returns {SVGBuilder}
     */
    setViewBox(x, y, width, height) {
        this.viewBox = `${x} ${y} ${width} ${height}`;
        return this;
    }

    /**
     * Add a background rectangle
     * @param {string} fill - Fill color or gradient ID
     * @param {Object} options - Additional options
     * @returns {SVGBuilder}
     */
    addBackground(fill, options = {}) {
        const attrs = {
            x: 0,
            y: 0,
            width: this.width,
            height: this.height,
            fill: fill.startsWith('#') || fill.startsWith('rgb') ? fill : `url(#${fill})`,
            ...options
        };

        this.elements.unshift(this.createRect(attrs));
        return this;
    }

    /**
     * Create a rectangle element string
     * @param {Object} attrs - Rectangle attributes
     * @returns {string}
     */
    createRect(attrs) {
        const attrString = this.buildAttributeString(attrs);
        return `<rect ${attrString}/>`;
    }

    /**
     * Add a rectangle
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {Object} attrs - Additional attributes
     * @returns {SVGBuilder}
     */
    addRect(x, y, width, height, attrs = {}) {
        this.elements.push(this.createRect({ x, y, width, height, ...attrs }));
        return this;
    }

    /**
     * Add a circle
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} r - Radius
     * @param {Object} attrs - Additional attributes
     * @returns {SVGBuilder}
     */
    addCircle(cx, cy, r, attrs = {}) {
        const attrString = this.buildAttributeString({ cx, cy, r, ...attrs });
        this.elements.push(`<circle ${attrString}/>`);
        return this;
    }

    /**
     * Add a path
     * @param {string} d - Path data
     * @param {Object} attrs - Additional attributes
     * @returns {SVGBuilder}
     */
    addPath(d, attrs = {}) {
        const attrString = this.buildAttributeString({ d, ...attrs });
        this.elements.push(`<path ${attrString}/>`);
        return this;
    }

    /**
     * Add raw SVG content
     * @param {string} content - Raw SVG content
     * @returns {SVGBuilder}
     */
    addRaw(content) {
        this.elements.push(content);
        return this;
    }

    /**
     * Add a group
     * @param {string} content - Group content
     * @param {Object} attrs - Group attributes
     * @returns {SVGBuilder}
     */
    addGroup(content, attrs = {}) {
        const attrString = this.buildAttributeString(attrs);
        this.elements.push(`<g ${attrString}>${content}</g>`);
        return this;
    }

    /**
     * Create a linear gradient definition
     * @param {Object} options - Gradient options
     * @returns {string} - Gradient ID
     */
    createLinearGradient(options = {}) {
        const id = options.id || `linearGradient${++this.gradientCounter}`;
        const angle = options.angle || 0;
        const colors = options.colors || [
            { color: '#000000', stop: 0 },
            { color: '#ffffff', stop: 100 }
        ];

        // Convert angle to x1, y1, x2, y2 coordinates
        const coords = this.angleToGradientCoords(angle);

        let stops = '';
        for (const colorStop of colors) {
            const offset = colorStop.stop !== undefined ? colorStop.stop : colorStop.offset || 0;
            const opacity = colorStop.opacity !== undefined ? colorStop.opacity : 1;
            stops += `<stop offset="${offset}%" stop-color="${colorStop.color}" stop-opacity="${opacity}"/>`;
        }

        const gradient = `<linearGradient id="${id}" x1="${coords.x1}%" y1="${coords.y1}%" x2="${coords.x2}%" y2="${coords.y2}%">${stops}</linearGradient>`;

        this.defs.push(gradient);
        return id;
    }

    /**
     * Create a radial gradient definition
     * @param {Object} options - Gradient options
     * @returns {string} - Gradient ID
     */
    createRadialGradient(options = {}) {
        const id = options.id || `radialGradient${++this.gradientCounter}`;
        const cx = options.cx || 50;
        const cy = options.cy || 50;
        const r = options.r || 50;
        const fx = options.fx || cx;
        const fy = options.fy || cy;
        const colors = options.colors || [
            { color: '#000000', stop: 0 },
            { color: '#ffffff', stop: 100 }
        ];

        let stops = '';
        for (const colorStop of colors) {
            const offset = colorStop.stop !== undefined ? colorStop.stop : colorStop.offset || 0;
            const opacity = colorStop.opacity !== undefined ? colorStop.opacity : 1;
            stops += `<stop offset="${offset}%" stop-color="${colorStop.color}" stop-opacity="${opacity}"/>`;
        }

        const gradient = `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="${r}%" fx="${fx}%" fy="${fy}%">${stops}</radialGradient>`;

        this.defs.push(gradient);
        return id;
    }

    /**
     * Convert angle (degrees) to gradient coordinates
     * @param {number} angle - Angle in degrees
     * @returns {Object} - {x1, y1, x2, y2}
     */
    angleToGradientCoords(angle) {
        // Normalize angle to 0-360
        angle = ((angle % 360) + 360) % 360;

        // Convert to radians
        const radians = (angle - 90) * (Math.PI / 180);

        // Calculate coordinates on a unit circle, then map to 0-100%
        const x1 = 50 + Math.cos(radians + Math.PI) * 50;
        const y1 = 50 + Math.sin(radians + Math.PI) * 50;
        const x2 = 50 + Math.cos(radians) * 50;
        const y2 = 50 + Math.sin(radians) * 50;

        return {
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2)
        };
    }

    /**
     * Add a drop shadow filter
     * @param {Object} options - Filter options
     * @returns {string} - Filter ID
     */
    createDropShadow(options = {}) {
        const id = options.id || `dropShadow${++this.filterCounter}`;
        const dx = options.dx || 2;
        const dy = options.dy || 2;
        const blur = options.blur || 4;
        const color = options.color || 'rgba(0,0,0,0.3)';

        const filter = `
            <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blur}" flood-color="${color}"/>
            </filter>
        `;

        this.defs.push(filter);
        return id;
    }

    /**
     * Create a clip path
     * @param {string} content - Clip path content
     * @param {Object} options - Options
     * @returns {string} - Clip path ID
     */
    createClipPath(content, options = {}) {
        const id = options.id || `clipPath${++this.gradientCounter}`;
        this.defs.push(`<clipPath id="${id}">${content}</clipPath>`);
        return id;
    }

    /**
     * Add a definition directly
     * @param {string} defContent - Definition content
     * @returns {SVGBuilder}
     */
    addDef(defContent) {
        this.defs.push(defContent);
        return this;
    }

    /**
     * Build attribute string from object
     * @param {Object} attrs - Attributes object
     * @returns {string}
     */
    buildAttributeString(attrs) {
        return Object.entries(attrs)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => {
                // Convert camelCase to kebab-case for SVG attributes
                const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                // Escape attribute values
                const escapedValue = String(value).replace(/"/g, '&quot;');
                return `${kebabKey}="${escapedValue}"`;
            })
            .join(' ');
    }

    /**
     * Build the final SVG string
     * @returns {string}
     */
    build() {
        const viewBoxAttr = this.viewBox
            ? `viewBox="${this.viewBox}"`
            : `viewBox="0 0 ${this.width} ${this.height}"`;

        const defsSection = this.defs.length > 0
            ? `<defs>${this.defs.join('\n')}</defs>`
            : '';

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${this.xmlns}" width="${this.width}" height="${this.height}" ${viewBoxAttr}>
${defsSection}
${this.elements.join('\n')}
</svg>`;
    }

    /**
     * Build the SVG without XML declaration (for embedding)
     * @returns {string}
     */
    buildWithoutDeclaration() {
        const viewBoxAttr = this.viewBox
            ? `viewBox="${this.viewBox}"`
            : `viewBox="0 0 ${this.width} ${this.height}"`;

        const defsSection = this.defs.length > 0
            ? `<defs>${this.defs.join('\n')}</defs>`
            : '';

        return `<svg xmlns="${this.xmlns}" width="${this.width}" height="${this.height}" ${viewBoxAttr}>
${defsSection}
${this.elements.join('\n')}
</svg>`;
    }

    /**
     * Convert to base64
     * @returns {string}
     */
    toBase64() {
        const svg = this.build();
        return Buffer.from(svg).toString('base64');
    }

    /**
     * Convert to data URL
     * @returns {string}
     */
    toDataUrl() {
        return `data:image/svg+xml;base64,${this.toBase64()}`;
    }

    /**
     * Get the raw SVG string
     * @returns {string}
     */
    toString() {
        return this.build();
    }

    /**
     * Clear all elements and defs
     * @returns {SVGBuilder}
     */
    clear() {
        this.defs = [];
        this.elements = [];
        this.gradientCounter = 0;
        this.filterCounter = 0;
        return this;
    }

    /**
     * Clone this builder
     * @returns {SVGBuilder}
     */
    clone() {
        const cloned = new SVGBuilder(this.width, this.height, { ...this.options });
        cloned.defs = [...this.defs];
        cloned.elements = [...this.elements];
        cloned.gradientCounter = this.gradientCounter;
        cloned.filterCounter = this.filterCounter;
        cloned.viewBox = this.viewBox;
        return cloned;
    }

    /**
     * Create QR module path data
     * This creates a path for a single QR module (square, circle, rounded, etc.)
     *
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Module size
     * @param {string} shape - Shape type (square, circle, rounded, etc.)
     * @param {Object} options - Additional options
     * @returns {string} - Path data string
     */
    static createModulePath(x, y, size, shape = 'square', options = {}) {
        const halfSize = size / 2;
        const cornerRadius = options.cornerRadius || size * 0.25;

        switch (shape.toLowerCase()) {
            case 'circle':
            case 'dot':
            case 'dots':
                // Circle path using arc commands
                const cx = x + halfSize;
                const cy = y + halfSize;
                const r = halfSize * 0.9; // Slightly smaller for separation
                return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;

            case 'rounded':
                // Rounded rectangle with corner radius
                const cr = Math.min(cornerRadius, halfSize);
                return this.createRoundedRectPath(x, y, size, size, cr);

            case 'extra-rounded':
            case 'extraRounded':
                // Extra rounded (more circular)
                const ecr = halfSize * 0.5;
                return this.createRoundedRectPath(x, y, size, size, ecr);

            case 'rhombus':
            case 'diamond':
                // Diamond/rhombus shape
                return `M ${x + halfSize} ${y} L ${x + size} ${y + halfSize} L ${x + halfSize} ${y + size} L ${x} ${y + halfSize} Z`;

            case 'vertical':
            case 'vertical-line':
            case 'verticalLine':
                // Vertical line
                const vWidth = size * 0.4;
                const vOffset = (size - vWidth) / 2;
                return `M ${x + vOffset} ${y} L ${x + vOffset + vWidth} ${y} L ${x + vOffset + vWidth} ${y + size} L ${x + vOffset} ${y + size} Z`;

            case 'horizontal':
            case 'horizontal-line':
            case 'horizontalLine':
                // Horizontal line
                const hHeight = size * 0.4;
                const hOffset = (size - hHeight) / 2;
                return `M ${x} ${y + hOffset} L ${x + size} ${y + hOffset} L ${x + size} ${y + hOffset + hHeight} L ${x} ${y + hOffset + hHeight} Z`;

            case 'square':
            default:
                // Simple square
                return `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size} L ${x} ${y + size} Z`;
        }
    }

    /**
     * Create a rounded rectangle path
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} r - Corner radius
     * @returns {string} - Path data
     */
    static createRoundedRectPath(x, y, width, height, r) {
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
     * Create finder pattern (the three large squares in QR corners)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} moduleSize - Size of one module
     * @param {string} shape - Shape type
     * @param {Object} colors - Colors for outer, middle, inner
     * @returns {Object} - {outer, middle, inner} path data
     */
    static createFinderPattern(x, y, moduleSize, shape = 'square', colors = {}) {
        const outerSize = moduleSize * 7;
        const middleSize = moduleSize * 5;
        const innerSize = moduleSize * 3;

        const middleOffset = moduleSize;
        const innerOffset = moduleSize * 2;

        const paths = {
            outer: '',
            middle: '',
            inner: ''
        };

        switch (shape.toLowerCase()) {
            case 'circle':
            case 'dot':
                paths.outer = this.createCircleFinderPath(x, y, outerSize, false);
                paths.middle = this.createCircleFinderPath(x + middleOffset, y + middleOffset, middleSize, true);
                paths.inner = this.createCircleFinderPath(x + innerOffset, y + innerOffset, innerSize, false);
                break;

            case 'rounded':
                const rOuter = moduleSize;
                const rMiddle = moduleSize * 0.8;
                const rInner = moduleSize * 0.6;
                paths.outer = this.createRoundedFinderPath(x, y, outerSize, rOuter, false);
                paths.middle = this.createRoundedFinderPath(x + middleOffset, y + middleOffset, middleSize, rMiddle, true);
                paths.inner = this.createRoundedFinderPath(x + innerOffset, y + innerOffset, innerSize, rInner, false);
                break;

            case 'extra-rounded':
            case 'extraRounded':
                const erOuter = moduleSize * 1.5;
                const erMiddle = moduleSize * 1.2;
                const erInner = moduleSize;
                paths.outer = this.createRoundedFinderPath(x, y, outerSize, erOuter, false);
                paths.middle = this.createRoundedFinderPath(x + middleOffset, y + middleOffset, middleSize, erMiddle, true);
                paths.inner = this.createRoundedFinderPath(x + innerOffset, y + innerOffset, innerSize, erInner, false);
                break;

            case 'leaf':
                paths.outer = this.createLeafFinderPath(x, y, outerSize, false);
                paths.middle = this.createLeafFinderPath(x + middleOffset, y + middleOffset, middleSize, true);
                paths.inner = this.createLeafFinderPath(x + innerOffset, y + innerOffset, innerSize, false);
                break;

            case 'square':
            default:
                paths.outer = this.createSquareFinderPath(x, y, outerSize, false);
                paths.middle = this.createSquareFinderPath(x + middleOffset, y + middleOffset, middleSize, true);
                paths.inner = this.createSquareFinderPath(x + innerOffset, y + innerOffset, innerSize, false);
                break;
        }

        return paths;
    }

    /**
     * Create a square finder pattern path
     */
    static createSquareFinderPath(x, y, size, isHollow = false) {
        if (isHollow) {
            // Create hollow square (just the outline)
            const innerPadding = size / 5;
            const outer = `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size} L ${x} ${y + size} Z`;
            const inner = `M ${x + innerPadding} ${y + innerPadding} L ${x + size - innerPadding} ${y + innerPadding} L ${x + size - innerPadding} ${y + size - innerPadding} L ${x + innerPadding} ${y + size - innerPadding} Z`;
            return outer + ' ' + inner;
        }
        return `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size} L ${x} ${y + size} Z`;
    }

    /**
     * Create a circle finder pattern path
     */
    static createCircleFinderPath(x, y, size, isHollow = false) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2;

        if (isHollow) {
            const innerR = r * 0.6;
            const outer = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
            const inner = `M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`;
            return outer + ' ' + inner;
        }
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
    }

    /**
     * Create a rounded finder pattern path
     */
    static createRoundedFinderPath(x, y, size, radius, isHollow = false) {
        const path = this.createRoundedRectPath(x, y, size, size, radius);

        if (isHollow) {
            const innerPadding = size / 5;
            const innerRadius = radius * 0.6;
            const innerPath = this.createRoundedRectPath(
                x + innerPadding,
                y + innerPadding,
                size - innerPadding * 2,
                size - innerPadding * 2,
                innerRadius
            );
            return path + ' ' + innerPath;
        }
        return path;
    }

    /**
     * Create a leaf-shaped finder pattern path
     */
    static createLeafFinderPath(x, y, size, isHollow = false) {
        const r = size * 0.5;

        // Leaf shape - rounded on two diagonal corners
        const path = `M ${x} ${y + r} ` +
            `Q ${x} ${y} ${x + r} ${y} ` +
            `L ${x + size} ${y} ` +
            `L ${x + size} ${y + size - r} ` +
            `Q ${x + size} ${y + size} ${x + size - r} ${y + size} ` +
            `L ${x} ${y + size} Z`;

        if (isHollow) {
            const padding = size / 5;
            const innerR = r * 0.6;
            const innerPath = `M ${x + padding} ${y + padding + innerR} ` +
                `Q ${x + padding} ${y + padding} ${x + padding + innerR} ${y + padding} ` +
                `L ${x + size - padding} ${y + padding} ` +
                `L ${x + size - padding} ${y + size - padding - innerR} ` +
                `Q ${x + size - padding} ${y + size - padding} ${x + size - padding - innerR} ${y + size - padding} ` +
                `L ${x + padding} ${y + size - padding} Z`;
            return path + ' ' + innerPath;
        }
        return path;
    }
}

module.exports = SVGBuilder;
