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
const LaravelPaths = require('./LaravelPaths');

class FinderProcessor extends BaseProcessor {
    constructor() {
        super('FinderProcessor', 8);

        // Ported shapes from Laravel
        const portedFinders = [
            'eye-shaped', 'octagon', 'rounded-corners', 'water-drop',
            'whirlpool', 'zigzag', 'circle', 'circle-dots'
        ];

        const portedDots = [
            'eye-shaped', 'octagon', 'rounded-corners', 'water-drop',
            'whirlpool', 'zigzag', 'circle'
        ];

        // Map of supported finder shapes
        this.finderShapes = {
            'square': this.createSquareFinder.bind(this),
            'default': this.createSquareFinder.bind(this),
            'circle': this.createLaravelFinder('circle'), // Ported
            'dot': this.createLaravelFinder('circle'),    // Ported
            'rounded': this.createLaravelFinder('rounded-corners'), // Ported
            'rounded-corners': this.createLaravelFinder('rounded-corners'), // Ported
            'roundedCorners': this.createLaravelFinder('rounded-corners'), // Ported
            'extra-rounded': this.createExtraRoundedFinder.bind(this),
            'extraRounded': this.createExtraRoundedFinder.bind(this),
            'leaf': this.createLeafFinder.bind(this),
            'diamond': this.createDiamondFinder.bind(this),
            'rhombus': this.createDiamondFinder.bind(this),
            // New shapes (Ported)
            'eye-shaped': this.createLaravelFinder('eye-shaped'),
            'eyeShaped': this.createLaravelFinder('eye-shaped'),
            'octagon': this.createLaravelFinder('octagon'),
            'whirlpool': this.createLaravelFinder('whirlpool'),
            'water-drop': this.createLaravelFinder('water-drop'),
            'waterDrop': this.createLaravelFinder('water-drop'),
            'zigzag': this.createLaravelFinder('zigzag'),
            'circle-dots': this.createLaravelFinder('circle-dots'),
            'circleDots': this.createLaravelFinder('circle-dots'),
        };

        // Map of supported finder dot shapes
        this.dotShapes = {
            'square': this.createSquareDot.bind(this),
            'default': this.createSquareDot.bind(this),
            'circle': this.createLaravelDot('circle'), // Ported
            'dot': this.createLaravelDot('circle'),    // Ported
            'rounded': this.createLaravelDot('rounded-corners'), // Ported
            'rounded-corners': this.createLaravelDot('rounded-corners'), // Ported
            'roundedCorners': this.createLaravelDot('rounded-corners'), // Ported
            'diamond': this.createDiamondDot.bind(this),
            'rhombus': this.createDiamondDot.bind(this),
            'star': this.createStarDot.bind(this),
            'heart': this.createHeartDot.bind(this),
            // New shapes (Ported)
            'eye-shaped': this.createLaravelDot('eye-shaped'),
            'eyeShaped': this.createLaravelDot('eye-shaped'),
            'octagon': this.createLaravelDot('octagon'),
            'whirlpool': this.createLaravelDot('whirlpool'),
            'water-drop': this.createLaravelDot('water-drop'),
            'waterDrop': this.createLaravelDot('water-drop'),
            'zigzag': this.createLaravelDot('zigzag'),
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

        console.log(`[FinderProcessor] process called with design.finder: ${design.finder}, design.finderDot: ${design.finderDot}`);

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

        console.log(`[FinderProcessor] Final finder shape: ${finderShape}, dot shape: ${finderDotShape}`);
        console.log(`[FinderProcessor] Generator exists - finder: ${!!payload.finderPathGenerator}, dot: ${!!payload.finderDotPathGenerator}`);
        this.log('Finder shape: ' + finderShape + ', dot shape: ' + finderDotShape);

        return payload;
    }

    /**
     * Normalize shape name
     */
    normalizeShape(shape, shapeMap) {
        if (!shape) return 'square';

        const normalized = shape.toLowerCase().replace(/_/g, '-');

        // Try normalized version first
        if (shapeMap[normalized]) {
            console.log(`[FinderProcessor] Shape resolved: ${shape} → ${normalized}`);
            return normalized;
        }

        // Try original value
        if (shapeMap[shape]) {
            console.log(`[FinderProcessor] Shape resolved (direct): ${shape}`);
            return shape;
        }

        console.log(`[FinderProcessor] Unknown finder shape: ${shape} (normalized: ${normalized}), falling back to square`);
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
     *
     * IMPORTANT: For Laravel ported shapes, the original paths are COMPOUND paths
     * (donut shapes with inner cutouts built-in). For proper layered rendering:
     * - outerPath: Solid outer boundary (filled with eye external color)
     * - innerPath: Solid inner boundary (filled with background to create hollow ring)
     * - dotPath: Center dot (filled with eye internal color)
     *
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

        // Get the generator functions
        const finderGenerator = this.getFinderPathGenerator(finderShape);
        const dotGenerator = this.getDotPathGenerator(dotShape);

        // Check if this is a Laravel compound path (donut with hole already cut out)
        const isLaravelCompoundPath = finderGenerator.isLaravelPath;

        if (isLaravelCompoundPath) {
            // Laravel paths are compound paths with inner cutouts already built-in
            // We only need to draw the outer (compound) path and the center dot
            // NO inner path needed (it would create a double-hollow effect)
            return {
                outerPath: finderGenerator(x, y, outerSize),
                innerPath: '', // Empty - the hole is already in the compound path
                dotPath: dotGenerator(x + dotOffset, y + dotOffset, dotSize),
            };
        }

        // Non-Laravel shapes use standard three-layer approach:
        // 1. Draw outer solid shape (filled with eye color)
        // 2. Draw inner solid shape (filled with background) → creates hollow ring
        // 3. Draw center dot (filled with internal color)
        return {
            outerPath: finderGenerator(x, y, outerSize),
            innerPath: finderGenerator(x + innerOffset, y + innerOffset, innerSize),
            dotPath: dotGenerator(x + dotOffset, y + dotOffset, dotSize),
        };
    }

    /**
     * Create a SOLID finder path from Laravel compound paths.
     *
     * Laravel paths are compound paths (donut shapes) with:
     * - First subpath: Outer boundary
     * - Second subpath: Inner cutout boundary
     *
     * This method extracts just one solid subpath for proper layered rendering.
     *
     * @param {string} shapeName - Laravel shape name
     * @param {string} part - 'outer' or 'inner'
     * @returns {Function} - Path generator function (x, y, size) => path
     */
    createLaravelFinderSolid(shapeName, part = 'outer') {
        return (x, y, size) => {
            const config = LaravelPaths.finders[shapeName];
            if (!config) {
                console.warn(`[FinderProcessor] Laravel finder shape '${shapeName}' not found`);
                return this.createSquareFinder(x, y, size);
            }

            // Extract the appropriate solid subpath
            let solidPath;
            if (part === 'outer') {
                solidPath = LaravelPaths.getOuterSolidPath(config.path);
            } else if (part === 'inner') {
                solidPath = LaravelPaths.getInnerSolidPath(config.path);
                // If no inner subpath exists (single solid path), use the same shape
                if (!solidPath) {
                    solidPath = LaravelPaths.getOuterSolidPath(config.path);
                }
            } else {
                solidPath = config.path;
            }

            const scale = size / 700;
            let transform = `translate(${x},${y}) scale(${scale})`;

            // If shape requires flipping (like some asymmetrical patterns in Laravel)
            if (config.shouldFlip) {
                transform = `translate(${x + size},${y}) scale(-${scale},${scale})`;
            }

            return {
                d: solidPath,
                attrs: {
                    transform
                }
            };
        };
    }

    /**
     * Create a finder pattern using Laravel SVG path
     * @param {string} shapeName
     */
    createLaravelFinder(shapeName) {
        const generator = (x, y, size) => {
            const config = LaravelPaths.finders[shapeName];
            if (!config) {
                console.warn(`[FinderProcessor] Laravel finder shape '${shapeName}' not found`);
                return this.createSquareFinder(x, y, size);
            }

            // Laravel viewBox is 700x700, apply shape-specific scale if defined
            const viewBoxSize = 700;
            const baseScale = size / viewBoxSize;
            const shapeScale = config.scale || 1.0;
            const finalScale = baseScale * shapeScale;

            // Default transform: move to x,y and scale
            let transform = `translate(${x},${y}) scale(${finalScale})`;

            // If shape requires flipping (like some asymmetrical patterns in Laravel)
            if (config.shouldFlip) {
                // To flip horizontally around the center of the shape:
                // 1. Move to (x,y)
                // 2. Move by width (size, 0)
                // 3. Scale by (-1, 1) * original_scale
                transform = `translate(${x + size},${y}) scale(-${finalScale},${finalScale})`;
            }

            return {
                d: config.path,
                attrs: {
                    transform
                }
            };
        };

        // Mark this as a Laravel compound path (donut with hole already cut out)
        generator.isLaravelPath = true;

        return generator;
    }

    /**
     * Create a finder dot using Laravel SVG path
     * @param {string} shapeName
     */
    createLaravelDot(shapeName) {
        const generator = (x, y, size) => {
            const config = LaravelPaths.dots[shapeName] || LaravelPaths.finders[shapeName];

            // If dot not found in specific dots or generic finders, use square
            if (!config) {
                // Try searching finders map if dot map fails (or fallback)
                if (LaravelPaths.finders[shapeName]) {
                    // logic handled by || above
                } else {
                    console.warn(`[FinderProcessor] Laravel dot shape '${shapeName}' not found`);
                    return this.createSquareDot(x, y, size);
                }
            }

            // Note: Use config found (either from dots or finders)
            // Some dots might re-use finder shapes if not explicitly defined in 'dots'
            // But LaravelPath.dots usually has specific ones. 
            // In LaravelPaths.js I populated 'dots' specifically.

            // Laravel viewBox is 700x700
            const viewBoxSize = 700;
            const baseScale = size / viewBoxSize;

            // IMPORTANT: Dots should NOT inherit scale from finder shapes!
            // Only use scale if it's defined specifically in LaravelPaths.dots
            // If we're using a finder as fallback, ignore its scale property
            const dotConfig = LaravelPaths.dots[shapeName];
            const shapeScale = (dotConfig && dotConfig.scale) || 1.0;
            const finalScale = baseScale * shapeScale;

            // IMPORTANT: Dot paths in Laravel are centered at viewBox center (350,350)
            // not at (0,0). To center the dot in the target area, we need to:
            // 1. translate(x, y) - move to target position  
            // 2. translate(size/2, size/2) - move to center of target area
            // 3. scale(finalScale) - scale down from 700x700
            // 4. translate(-350, -350) - center the viewBox content

            const viewBoxCenter = viewBoxSize / 2; // 350

            let transform = `translate(${x + size / 2},${y + size / 2}) scale(${finalScale}) translate(-${viewBoxCenter},-${viewBoxCenter})`;

            if (config && config.shouldFlip) {
                transform = `translate(${x + size / 2},${y + size / 2}) scale(-${finalScale},${finalScale}) translate(-${viewBoxCenter},-${viewBoxCenter})`;
            }

            // Careful: if config wasn't found in dots but used finder fallback, it might be large. 
            // But 'size' passed here is dotSize (3 modules). 
            // Laravel paths are 700x700 relative units. Scaling by size/700 makes it fit 'size'.
            // So logical reuse is fine.

            return {
                d: (config || LaravelPaths.finders[shapeName] || {}).path || '',
                attrs: {
                    transform
                }
            };
        };

        // Mark this as a Laravel path
        generator.isLaravelPath = true;

        return generator;
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
        console.log(`[FinderProcessor] createEyeShapedFinder called: x=${x}, y=${y}, size=${size}`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const rx = size * 0.5;  // Horizontal radius
        const ry = size * 0.35; // Vertical radius (flatter)

        // Eye/almond shape using cubic bezier for smoother curves
        const path = `M ${x} ${cy} ` +
            `C ${x} ${cy - ry} ${cx - rx * 0.5} ${y + size * 0.1} ${cx} ${y + size * 0.1} ` +
            `C ${cx + rx * 0.5} ${y + size * 0.1} ${x + size} ${cy - ry} ${x + size} ${cy} ` +
            `C ${x + size} ${cy + ry} ${cx + rx * 0.5} ${y + size * 0.9} ${cx} ${y + size * 0.9} ` +
            `C ${cx - rx * 0.5} ${y + size * 0.9} ${x} ${cy + ry} ${x} ${cy} Z`;
        return path;
    }

    /**
     * Octagon finder pattern
     */
    createOctagonFinder(x, y, size) {
        console.log(`[FinderProcessor] createOctagonFinder called: x=${x}, y=${y}, size=${size}`);
        const cut = size * 0.29; // Corner cut amount (about 1/3)

        const path = `M ${x + cut} ${y} ` +
            `L ${x + size - cut} ${y} ` +
            `L ${x + size} ${y + cut} ` +
            `L ${x + size} ${y + size - cut} ` +
            `L ${x + size - cut} ${y + size} ` +
            `L ${x + cut} ${y + size} ` +
            `L ${x} ${y + size - cut} ` +
            `L ${x} ${y + cut} Z`;
        return path;
    }

    /**
     * Whirlpool finder pattern (rounded square with slight rotation effect)
     */
    createWhirlpoolFinder(x, y, size) {
        console.log(`[FinderProcessor] createWhirlpoolFinder called: x=${x}, y=${y}, size=${size}`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size * 0.45;
        const twist = size * 0.08; // Amount of twist

        // Create a twisted rounded square effect
        const path = `M ${cx - r} ${cy - twist} ` +
            `Q ${cx - twist} ${cy - r} ${cx + twist} ${cy - r} ` +
            `Q ${cx + r} ${cy - twist} ${cx + r} ${cy + twist} ` +
            `Q ${cx + twist} ${cy + r} ${cx - twist} ${cy + r} ` +
            `Q ${cx - r} ${cy + twist} ${cx - r} ${cy - twist} Z`;
        return path;
    }

    /**
     * Water-drop finder pattern (teardrop shape)
     */
    createWaterDropFinder(x, y, size) {
        console.log(`[FinderProcessor] createWaterDropFinder called: x=${x}, y=${y}, size=${size}`);
        const cx = x + size / 2;
        const r = size * 0.38;

        // Teardrop: pointed at top, rounded at bottom
        const path = `M ${cx} ${y + size * 0.05} ` +
            `C ${x + size * 0.85} ${y + size * 0.25} ${x + size * 0.95} ${y + size * 0.55} ${x + size * 0.75} ${y + size * 0.75} ` +
            `A ${r} ${r} 0 1 1 ${x + size * 0.25} ${y + size * 0.75} ` +
            `C ${x + size * 0.05} ${y + size * 0.55} ${x + size * 0.15} ${y + size * 0.25} ${cx} ${y + size * 0.05} Z`;
        return path;
    }

    /**
     * Zigzag finder pattern (square with notched corners)
     */
    createZigzagFinder(x, y, size) {
        console.log(`[FinderProcessor] createZigzagFinder called: x=${x}, y=${y}, size=${size}`);
        const notch = size * 0.15; // Notch size

        // Simplified zigzag - square with notched/stepped corners
        const path = `M ${x + notch} ${y} ` +
            `L ${x + size - notch} ${y} ` +
            `L ${x + size - notch} ${y + notch} ` +
            `L ${x + size} ${y + notch} ` +
            `L ${x + size} ${y + size - notch} ` +
            `L ${x + size - notch} ${y + size - notch} ` +
            `L ${x + size - notch} ${y + size} ` +
            `L ${x + notch} ${y + size} ` +
            `L ${x + notch} ${y + size - notch} ` +
            `L ${x} ${y + size - notch} ` +
            `L ${x} ${y + notch} ` +
            `L ${x + notch} ${y + notch} Z`;
        return path;
    }

    /**
     * Circle-dots finder pattern (dotted circle outline)
     */
    createCircleDotsFinder(x, y, size) {
        console.log(`[FinderProcessor] createCircleDotsFinder called: x=${x}, y=${y}, size=${size}`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const mainR = size * 0.42;
        const dotR = size * 0.09;
        const numDots = 8; // Fewer dots for cleaner look

        let path = '';
        for (let i = 0; i < numDots; i++) {
            const angle = (i * 2 * Math.PI / numDots) - Math.PI / 2;
            const dotX = cx + mainR * Math.cos(angle);
            const dotY = cy + mainR * Math.sin(angle);

            // Each dot is a small circle using arc commands
            path += `M ${dotX - dotR} ${dotY} ` +
                `A ${dotR} ${dotR} 0 1 0 ${dotX + dotR} ${dotY} ` +
                `A ${dotR} ${dotR} 0 1 0 ${dotX - dotR} ${dotY} `;
        }

        return path || this.createCircleFinder(x, y, size); // Fallback
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
        console.log(`[FinderProcessor] createEyeShapedDot called`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const rx = size * 0.45;
        const ry = size * 0.3;

        // Simpler eye shape using quadratic curves
        return `M ${x + size * 0.05} ${cy} ` +
            `Q ${cx} ${y + size * 0.15} ${x + size * 0.95} ${cy} ` +
            `Q ${cx} ${y + size * 0.85} ${x + size * 0.05} ${cy} Z`;
    }

    /**
     * Octagon dot
     */
    createOctagonDot(x, y, size) {
        console.log(`[FinderProcessor] createOctagonDot called`);
        const cut = size * 0.28;

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
     * Whirlpool dot (twisted rounded shape)
     */
    createWhirlpoolDot(x, y, size) {
        console.log(`[FinderProcessor] createWhirlpoolDot called`);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size * 0.4;
        const twist = size * 0.06;

        // Twisted rounded square
        return `M ${cx - r} ${cy - twist} ` +
            `Q ${cx - twist} ${cy - r} ${cx + twist} ${cy - r} ` +
            `Q ${cx + r} ${cy - twist} ${cx + r} ${cy + twist} ` +
            `Q ${cx + twist} ${cy + r} ${cx - twist} ${cy + r} ` +
            `Q ${cx - r} ${cy + twist} ${cx - r} ${cy - twist} Z`;
    }

    /**
     * Water-drop dot (teardrop)
     */
    createWaterDropDot(x, y, size) {
        console.log(`[FinderProcessor] createWaterDropDot called`);
        const cx = x + size / 2;
        const r = size * 0.32;

        // Simpler teardrop shape
        return `M ${cx} ${y + size * 0.08} ` +
            `C ${x + size * 0.85} ${y + size * 0.3} ${x + size * 0.9} ${y + size * 0.6} ${x + size * 0.7} ${y + size * 0.78} ` +
            `A ${r} ${r} 0 1 1 ${x + size * 0.3} ${y + size * 0.78} ` +
            `C ${x + size * 0.1} ${y + size * 0.6} ${x + size * 0.15} ${y + size * 0.3} ${cx} ${y + size * 0.08} Z`;
    }

    /**
     * Zigzag dot (square with notched corners)
     */
    createZigzagDot(x, y, size) {
        console.log(`[FinderProcessor] createZigzagDot called`);
        const notch = size * 0.18;

        // Simplified zigzag - square with notched/stepped corners
        return `M ${x + notch} ${y} ` +
            `L ${x + size - notch} ${y} ` +
            `L ${x + size - notch} ${y + notch} ` +
            `L ${x + size} ${y + notch} ` +
            `L ${x + size} ${y + size - notch} ` +
            `L ${x + size - notch} ${y + size - notch} ` +
            `L ${x + size - notch} ${y + size} ` +
            `L ${x + notch} ${y + size} ` +
            `L ${x + notch} ${y + size - notch} ` +
            `L ${x} ${y + size - notch} ` +
            `L ${x} ${y + notch} ` +
            `L ${x + notch} ${y + notch} Z`;
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
