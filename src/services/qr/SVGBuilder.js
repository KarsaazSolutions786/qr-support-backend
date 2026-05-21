/**
 * Purpose: SVGBuilder - Builds and manipulates SVG documents for QR codes This class provides a fluent interface for creating SVG documents with support for gradients, paths, and other SVG elements.
 * Owner/Author: Syed Ashhad
 * Created/Updated: January 2026
 */

class SVGBuilder {
    /**
     * Purpose: Create a new SVGBuilder instance
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create an SVGBuilder from a size value
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    static create(size) {
        return new SVGBuilder(size, size);
    }

    /**
     * Purpose: Set the viewBox
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    setViewBox(x, y, width, height) {
        this.viewBox = `${x} ${y} ${width} ${height}`;
        return this;
    }

    /**
     * Purpose: Add a background rectangle
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a rectangle element string
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    createRect(attrs) {
        const attrString = this.buildAttributeString(attrs);
        return `<rect ${attrString}/>`;
    }

    /**
     * Purpose: Add a rectangle
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    addRect(x, y, width, height, attrs = {}) {
        this.elements.push(this.createRect({ x, y, width, height, ...attrs }));
        return this;
    }

    /**
     * Purpose: Add a circle
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    addCircle(cx, cy, r, attrs = {}) {
        const attrString = this.buildAttributeString({ cx, cy, r, ...attrs });
        this.elements.push(`<circle ${attrString}/>`);
        return this;
    }

    /**
     * Purpose: Add a path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    addPath(d, attrs = {}) {
        const attrString = this.buildAttributeString({ d, ...attrs });
        this.elements.push(`<path ${attrString}/>`);
        return this;
    }

    /**
     * Purpose: Add raw SVG content
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    addRaw(content) {
        this.elements.push(content);
        return this;
    }

    /**
     * Purpose: Add a group
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    addGroup(content, attrs = {}) {
        const attrString = this.buildAttributeString(attrs);
        this.elements.push(`<g ${attrString}>${content}</g>`);
        return this;
    }

    /**
     * Purpose: Create a linear gradient definition
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a radial gradient definition
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Convert angle (degrees) to gradient coordinates
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Add a drop shadow filter
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a clip path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    createClipPath(content, options = {}) {
        const id = options.id || `clipPath${++this.gradientCounter}`;
        this.defs.push(`<clipPath id="${id}">${content}</clipPath>`);
        return id;
    }

    /**
     * Purpose: Add a definition directly
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    addDef(defContent) {
        this.defs.push(defContent);
        return this;
    }

    /**
     * Purpose: Build attribute string from object
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Build the final SVG string
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Build the SVG without XML declaration (for embedding)
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Convert to base64
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    toBase64() {
        const svg = this.build();
        return Buffer.from(svg).toString('base64');
    }

    /**
     * Purpose: Convert to data URL
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    toDataUrl() {
        return `data:image/svg+xml;base64,${this.toBase64()}`;
    }

    /**
     * Purpose: Get the raw SVG string
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    toString() {
        return this.build();
    }

    /**
     * Purpose: Clear all elements and defs
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    clear() {
        this.defs = [];
        this.elements = [];
        this.gradientCounter = 0;
        this.filterCounter = 0;
        return this;
    }

    /**
     * Purpose: Clone this builder
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create QR module path data This creates a path for a single QR module (square, circle, rounded, etc.)
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a rounded rectangle path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create finder pattern (the three large squares in QR corners)
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a square finder pattern path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a circle finder pattern path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a rounded finder pattern path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Create a leaf-shaped finder pattern path
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
