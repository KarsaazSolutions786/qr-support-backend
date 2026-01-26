/**
 * SVG Preprocessor for Flutter Compatibility
 *
 * Processes SVG from Laravel backend to make it compatible with Sharp/libvips
 * for PNG conversion. Handles all the styling features Laravel supports.
 *
 * Laravel Features Supported:
 * - Module shapes: square, dots, rounded, extra-rounded, rhombus, vertical, horizontal
 * - Finder patterns: default, rounded, circle, eye-shaped, leaf, dot
 * - Finder dots: default, rounded, circle, eye-shaped, leaf, diamond
 * - Colors: foreground, background, eye colors
 * - Gradients: linear, radial with color stops
 * - Advanced shapes: four-corners-text-bottom, healthcare, review-collector
 * - Outlined shapes: apple, bag, car, star, etc.
 * - Logo embedding
 */

const logger = require('../utils/logger');

class SVGPreprocessor {
    /**
     * Process SVG for Sharp/Flutter compatibility
     *
     * @param {string} svgContent - Raw SVG from Laravel
     * @param {object} design - Design parameters (for reference)
     * @returns {string} Processed SVG ready for Sharp conversion
     */
    process(svgContent, design = {}) {
        if (!svgContent || typeof svgContent !== 'string') {
            throw new Error('Invalid SVG content');
        }

        let svg = svgContent;

        try {
            // Step 1: Ensure proper XML declaration
            svg = this.ensureXmlDeclaration(svg);

            // Step 2: Fix SVG dimensions and viewBox
            svg = this.fixDimensions(svg);

            // Step 3: Inline CSS styles (Sharp doesn't support <style> blocks well)
            svg = this.inlineCssStyles(svg);

            // Step 4: Convert CSS properties to SVG attributes
            svg = this.convertCssToAttributes(svg);

            // Step 5: Fix gradient definitions
            svg = this.fixGradients(svg);

            // Step 6: Fix transforms
            svg = this.fixTransforms(svg);

            // Step 7: Fix path data
            svg = this.fixPathData(svg);

            // Step 8: Remove unsupported features
            svg = this.removeUnsupportedFeatures(svg);

            // Step 9: Fix color formats
            svg = this.fixColors(svg);

            // Step 10: Ensure all elements have explicit fills
            svg = this.ensureExplicitFills(svg, design);

            // Step 11: Remove any duplicate attributes (critical for Sharp!)
            svg = this.removeDuplicateAttributes(svg);

            logger.debug('SVG preprocessing completed');
            return svg;
        } catch (error) {
            logger.error(`SVG preprocessing error: ${error.message}`);
            // Return original if preprocessing fails
            return svgContent;
        }
    }

    /**
     * Process SVG safely for complex stickers/shapes
     * Skips destructive operations like transform/path fixing
     */
    processSafe(svgContent, design = {}) {
        if (!svgContent || typeof svgContent !== 'string') {
            throw new Error('Invalid SVG content');
        }

        let svg = svgContent;
        logger.debug('Running SAFE SVG preprocessing for sticker...');

        try {
            // 1. XML Declaration (Essential)
            svg = this.ensureXmlDeclaration(svg);

            // 2. Dimensions (Essential)
            svg = this.fixDimensions(svg);

            // 3. Inline CSS (CRITICAL for stickers which use class-based styling)
            svg = this.inlineCssStyles(svg);

            // 4. Convert CSS to attributes (Sharp compatibility)
            svg = this.convertCssToAttributes(svg);

            // 5. Fix Color Formats (Safe)
            svg = this.fixColors(svg);

            // 6. Explicit Fills (Needed for background/foreground)
            svg = this.ensureExplicitFills(svg, design);

            // 7. Remove duplications (Safe)
            svg = this.removeDuplicateAttributes(svg);

            // SKIPPING: fixGradients, fixTransforms, fixPathData, removeUnsupportedFeatures
            // These are the most likely to break complex sticker templates

            return svg;
        } catch (error) {
            logger.error(`Safe SVG preprocessing error: ${error.message}`);
            return svgContent;
        }
    }

    /**
     * Ensure SVG has proper XML declaration
     */
    ensureXmlDeclaration(svg) {
        if (!svg.trim().startsWith('<?xml')) {
            svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
        }
        return svg;
    }

    /**
     * Fix SVG dimensions and viewBox
     */
    fixDimensions(svg) {
        // Extract viewBox if present
        const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
        let viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

        // If no viewBox, try to get from width/height
        if (!viewBox) {
            const widthMatch = svg.match(/width=["'](\d+)/);
            const heightMatch = svg.match(/height=["'](\d+)/);
            if (widthMatch && heightMatch) {
                viewBox = `0 0 ${widthMatch[1]} ${heightMatch[1]}`;
            } else {
                viewBox = '0 0 500 500'; // Default
            }
        }

        // Ensure width and height are set (without units for Sharp)
        const viewBoxParts = viewBox.split(/\s+/);
        const width = viewBoxParts[2] || 500;
        const height = viewBoxParts[3] || 500;

        // Remove pt/px units and set numeric values
        svg = svg.replace(/width=["'][^"']*["']/, `width="${width}"`);
        svg = svg.replace(/height=["'][^"']*["']/, `height="${height}"`);

        // Ensure viewBox is present
        if (!svg.includes('viewBox')) {
            svg = svg.replace(/<svg/, `<svg viewBox="${viewBox}"`);
        }

        return svg;
    }

    /**
     * Inline CSS styles from <style> blocks
     */
    inlineCssStyles(svg) {
        // Extract all style blocks
        const styleMatches = svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        const cssRules = {};

        for (const match of styleMatches) {
            const styleContent = match[1];
            this.parseCssRules(styleContent, cssRules);
        }

        // Apply CSS rules to elements
        for (const [selector, properties] of Object.entries(cssRules)) {
            svg = this.applyCssToElements(svg, selector, properties);
        }

        // Remove style blocks after inlining
        svg = svg.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        return svg;
    }

    /**
     * Parse CSS rules from style content
     */
    parseCssRules(styleContent, rules = {}) {
        // Handle CDATA wrapper
        let content = styleContent.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

        // Parse each rule
        const ruleRegex = /([.#]?[\w-]+(?:\s*,\s*[.#]?[\w-]+)*)\s*\{([^}]+)\}/g;
        let match;

        while ((match = ruleRegex.exec(content)) !== null) {
            const selectors = match[1].split(',').map(s => s.trim());
            const declarations = match[2].trim();
            const properties = {};

            declarations.split(';').forEach(decl => {
                const [prop, val] = decl.split(':').map(s => s.trim());
                if (prop && val) {
                    properties[prop] = val;
                }
            });

            selectors.forEach(selector => {
                rules[selector] = { ...(rules[selector] || {}), ...properties };
            });
        }

        return rules;
    }

    /**
     * Apply CSS properties to matching elements
     */
    applyCssToElements(svg, selector, properties) {
        const styleStr = Object.entries(properties)
            .map(([prop, val]) => `${prop}:${val}`)
            .join(';');

        if (selector.startsWith('.')) {
            // Class selector
            const className = selector.slice(1);
            const regex = new RegExp(
                `(<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)(/?>)`,
                'gi'
            );
            svg = svg.replace(regex, (match, start, end) => {
                if (start.includes('style=')) {
                    return start.replace(/style=["']([^"']*)["']/, `style="$1;${styleStr}"`) + end;
                }
                return `${start} style="${styleStr}"${end}`;
            });
        } else if (selector.startsWith('#')) {
            // ID selector
            const id = selector.slice(1);
            const regex = new RegExp(
                `(<[^>]*id=["']${id}["'][^>]*)(/?>)`,
                'gi'
            );
            svg = svg.replace(regex, (match, start, end) => {
                if (start.includes('style=')) {
                    return start.replace(/style=["']([^"']*)["']/, `style="$1;${styleStr}"`) + end;
                }
                return `${start} style="${styleStr}"${end}`;
            });
        } else {
            // Element selector (e.g., 'path', 'rect')
            const regex = new RegExp(`(<${selector}\\b[^>]*)(/?>)`, 'gi');
            svg = svg.replace(regex, (match, start, end) => {
                if (start.includes('style=')) {
                    return start.replace(/style=["']([^"']*)["']/, `style="$1;${styleStr}"`) + end;
                }
                return `${start} style="${styleStr}"${end}`;
            });
        }

        return svg;
    }

    /**
     * Convert inline CSS style properties to SVG attributes
     * NOTE: Must avoid creating duplicate attributes
     */
    convertCssToAttributes(svg) {
        // Map of CSS properties to SVG attributes
        const cssToSvgMap = {
            'fill': 'fill',
            'fill-opacity': 'fill-opacity',
            'stroke': 'stroke',
            'stroke-width': 'stroke-width',
            'stroke-opacity': 'stroke-opacity',
            'stroke-linecap': 'stroke-linecap',
            'stroke-linejoin': 'stroke-linejoin',
            'opacity': 'opacity',
        };

        // Process each element with style attribute
        // Match the whole element tag to check for existing attributes
        svg = svg.replace(/<(\w+)([^>]*?)\s+style=["']([^"']*)["']([^>]*?)(\/?>)/gi,
            (match, tagName, beforeStyle, styleContent, afterStyle, end) => {
                const fullAttrs = beforeStyle + afterStyle;
                const attributes = [];
                const remainingStyles = [];

                styleContent.split(';').forEach(decl => {
                    const parts = decl.split(':');
                    if (parts.length >= 2) {
                        const prop = parts[0].trim();
                        const val = parts.slice(1).join(':').trim();
                        if (prop && val) {
                            const attrName = cssToSvgMap[prop];
                            if (attrName) {
                                // Only add attribute if not already present in element
                                const attrRegex = new RegExp(`\\b${attrName}\\s*=`, 'i');
                                if (!attrRegex.test(fullAttrs)) {
                                    attributes.push(`${attrName}="${val}"`);
                                }
                                // Don't add to remaining styles - we either converted it or it's a duplicate
                            } else {
                                remainingStyles.push(`${prop}:${val}`);
                            }
                        }
                    }
                });

                // Reconstruct the element
                let result = `<${tagName}${beforeStyle}`;
                if (attributes.length > 0) {
                    result += ` ${attributes.join(' ')}`;
                }
                if (remainingStyles.length > 0) {
                    result += ` style="${remainingStyles.join(';')}"`;
                }
                result += `${afterStyle}${end}`;
                return result;
            });

        return svg;
    }

    /**
     * Fix gradient definitions for Sharp compatibility
     */
    fixGradients(svg) {
        // Ensure gradients have proper IDs
        let gradientCount = 0;

        // Fix linearGradient
        svg = svg.replace(/<linearGradient([^>]*)>/gi, (match, attrs) => {
            if (!attrs.includes('id=')) {
                gradientCount++;
                return `<linearGradient id="gradient-${gradientCount}"${attrs}>`;
            }
            return match;
        });

        // Fix radialGradient
        svg = svg.replace(/<radialGradient([^>]*)>/gi, (match, attrs) => {
            if (!attrs.includes('id=')) {
                gradientCount++;
                return `<radialGradient id="gradient-${gradientCount}"${attrs}>`;
            }
            return match;
        });

        // Ensure gradient stops have proper format
        svg = svg.replace(/<stop([^>]*)>/gi, (match, attrs) => {
            // Ensure offset is present
            if (!attrs.includes('offset')) {
                attrs += ' offset="0%"';
            }
            // Ensure stop-color is present
            if (!attrs.includes('stop-color') && !attrs.includes('style=')) {
                attrs += ' stop-color="#000000"';
            }
            return `<stop${attrs}>`;
        });

        return svg;
    }

    /**
     * Fix transform attributes for Sharp compatibility
     * Handles transform-origin by converting to translate operations
     */
    fixTransforms(svg) {
        // First, handle transform-origin by converting to translate operations
        // Sharp/libvips doesn't support transform-origin, so we need to convert:
        // transform="rotate(45) scale(0.5)" transform-origin="100 100"
        // Into:
        // transform="translate(100, 100) rotate(45) scale(0.5) translate(-100, -100)"
        svg = svg.replace(
            /<(\w+)([^>]*?)\s+transform=["']([^"']*)["']([^>]*?)\s+transform-origin=["']([^"']*)["']([^>]*?)(\/?>)/gi,
            (match, tagName, before, transform, middle, origin, after, end) => {
                const originParts = origin.trim().split(/[\s,]+/);
                const ox = parseFloat(originParts[0]) || 0;
                const oy = parseFloat(originParts[1] || originParts[0]) || 0;

                // Wrap transform with translate operations
                const newTransform = `translate(${ox}, ${oy}) ${transform} translate(${-ox}, ${-oy})`;

                return `<${tagName}${before} transform="${newTransform}"${middle}${after}${end}`;
            }
        );

        // Also handle when transform-origin comes BEFORE transform
        svg = svg.replace(
            /<(\w+)([^>]*?)\s+transform-origin=["']([^"']*)["']([^>]*?)\s+transform=["']([^"']*)["']([^>]*?)(\/?>)/gi,
            (match, tagName, before, origin, middle, transform, after, end) => {
                const originParts = origin.trim().split(/[\s,]+/);
                const ox = parseFloat(originParts[0]) || 0;
                const oy = parseFloat(originParts[1] || originParts[0]) || 0;

                // Wrap transform with translate operations
                const newTransform = `translate(${ox}, ${oy}) ${transform} translate(${-ox}, ${-oy})`;

                return `<${tagName}${before}${middle} transform="${newTransform}"${after}${end}`;
            }
        );

        // Remove any remaining standalone transform-origin attributes (shouldn't happen but cleanup)
        svg = svg.replace(/\s+transform-origin=["'][^"']*["']/gi, '');

        // Ensure transforms have proper format
        svg = svg.replace(/transform=["']([^"']*)["']/gi, (match, transform) => {
            // Fix common transform issues
            let fixed = transform
                // Ensure spaces between transforms
                .replace(/\)\s*([a-z])/gi, ') $1')
                // Fix scale without comma
                .replace(/scale\(([^,\)]+)\)/gi, 'scale($1, $1)')
                // Remove extra spaces
                .replace(/\s+/g, ' ')
                .trim();

            return `transform="${fixed}"`;
        });

        return svg;
    }

    /**
     * Fix path data for Sharp compatibility
     */
    fixPathData(svg) {
        svg = svg.replace(/d=["']([^"']*)["']/gi, (match, pathData) => {
            let fixed = pathData
                // Ensure spaces after commands
                .replace(/([MmLlHhVvCcSsQqTtAaZz])(\d)/g, '$1 $2')
                // Ensure spaces between numbers
                .replace(/(\d)-/g, '$1 -')
                // Remove extra spaces
                .replace(/\s+/g, ' ')
                .trim();

            return `d="${fixed}"`;
        });

        return svg;
    }

    /**
     * Remove features not supported by Sharp/libvips
     */
    removeUnsupportedFeatures(svg) {
        // Remove filter effects (can cause rendering issues)
        // svg = svg.replace(/<filter[\s\S]*?<\/filter>/gi, '');
        // svg = svg.replace(/filter=["'][^"']*["']/gi, '');

        // Remove mix-blend-mode (not supported)
        svg = svg.replace(/mix-blend-mode:[^;}"']+[;]?/gi, '');

        // Remove CSS variables
        svg = svg.replace(/var\([^)]+\)/gi, '#000000');

        // Remove clip-path references that might not resolve
        // svg = svg.replace(/clip-path=["']url\([^)]+\)["']/gi, '');

        return svg;
    }

    /**
     * Fix color formats
     */
    fixColors(svg) {
        // Expand 3-digit hex colors to 6-digit
        svg = svg.replace(/#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])(?![0-9a-fA-F])/g,
            '#$1$1$2$2$3$3');

        // Convert named colors to hex (common ones)
        const colorMap = {
            'black': '#000000',
            'white': '#ffffff',
            'red': '#ff0000',
            'green': '#008000',
            'blue': '#0000ff',
            'yellow': '#ffff00',
            'transparent': 'none',
        };

        for (const [name, hex] of Object.entries(colorMap)) {
            const regex = new RegExp(`(fill|stroke|stop-color)=["']${name}["']`, 'gi');
            svg = svg.replace(regex, `$1="${hex}"`);
        }

        return svg;
    }

    /**
     * Ensure all elements have explicit fill attributes
     * NOTE: This should NOT add duplicate fill attributes
     */
    ensureExplicitFills(svg, design) {
        const defaultFill = design.foreground_color || design.foregroundColor || '#000000';
        const bgFill = design.background_color || design.backgroundColor || '#ffffff';

        // Add default fill to paths without fill attribute
        // Use a more robust check to avoid duplicates
        svg = svg.replace(/<path\s([^>]*?)(\/?>)/gi, (match, attrs, end) => {
            // Skip if already has fill= attribute anywhere
            if (/\bfill\s*=/.test(attrs)) {
                return match;
            }
            // Check if it's a "light" class (background)
            if (attrs.includes('light')) {
                return `<path ${attrs} fill="${bgFill}"${end}`;
            }
            // Only add fill to dark class or unclassed paths
            if (attrs.includes('dark') || !attrs.includes('class=')) {
                return `<path ${attrs} fill="${defaultFill}"${end}`;
            }
            return match;
        });

        // Handle rect elements - only add fill if missing
        svg = svg.replace(/<rect\s([^>]*?)(\/?>)/gi, (match, attrs, end) => {
            // Skip if already has fill= attribute
            if (/\bfill\s*=/.test(attrs)) {
                return match;
            }
            // Background rect
            if (attrs.includes('qr-background')) {
                return `<rect ${attrs} fill="${bgFill}"${end}`;
            }
            return match;
        });

        return svg;
    }

    /**
     * Remove duplicate attributes from SVG elements
     * Sharp/libvips will fail if an element has the same attribute defined twice
     */
    removeDuplicateAttributes(svg) {
        // Match each element tag (opening tags with attributes)
        return svg.replace(/<(\w+)\s+([^>]*?)(\/?>)/gi, (match, tagName, attrs, end) => {
            if (!attrs || !attrs.trim()) {
                return match;
            }

            // Parse all attributes
            const attrMap = new Map();
            const attrRegex = /(\S+)=["']([^"']*)["']/g;
            let attrMatch;

            while ((attrMatch = attrRegex.exec(attrs)) !== null) {
                const [, name, value] = attrMatch;
                // Keep the last occurrence of each attribute
                attrMap.set(name.toLowerCase(), { name, value });
            }

            // Also handle attributes without quotes (like standalone attributes)
            const standaloneAttrs = attrs.replace(/\S+=["'][^"']*["']/g, '').trim();

            // Rebuild attributes string without duplicates
            const uniqueAttrs = Array.from(attrMap.values())
                .map(({ name, value }) => `${name}="${value}"`)
                .join(' ');

            const finalAttrs = [uniqueAttrs, standaloneAttrs].filter(Boolean).join(' ');

            return `<${tagName} ${finalAttrs}${end}`;
        });
    }

    /**
     * Get info about preprocessor capabilities
     */
    getInfo() {
        return {
            supportedFeatures: [
                'css-inlining',
                'gradient-fix',
                'transform-fix',
                'path-data-fix',
                'color-normalization',
                'dimension-fix',
                'safe-mode',
            ],
            laravelFeatures: [
                'module-shapes',
                'finder-patterns',
                'finder-dots',
                'colors',
                'gradients',
                'advanced-shapes',
                'outlined-shapes',
                'logo-embedding',
            ],
        };
    }
}

module.exports = new SVGPreprocessor();
