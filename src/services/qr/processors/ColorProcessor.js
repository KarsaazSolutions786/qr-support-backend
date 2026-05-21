/**
 * ColorProcessor - Handles colors and gradients for QR codes
 *
 * Sort Order: 5 (runs early in the pipeline)
 * Responsibilities:
 * - Parse and normalize colors
 * - Create gradient definitions
 * - Apply foreground/background colors
 * - Handle eye colors (inner/outer)
 */
const BaseProcessor = require('./BaseProcessor');
let Color = require('color');
if (Color.default) Color = Color.default;

/**
 * Purpose: Class definition for ColorProcessor.
 * Owner/Author: Syed Ashhad
 * Created/Updated: January 2026
 */
class ColorProcessor extends BaseProcessor {
    /**
     * Purpose: Constructor for constructor.
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    constructor() {
        super('ColorProcessor', 5);
    }

    /**
     * Purpose: Check if this processor should process the payload
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    shouldProcess(payload) {
        // Always process - colors are always needed
        return true;
    }

    /**
     * Purpose: Process the payload to apply colors
     * Owner/Author: Syed Ashhad
     * Created: January 2026
     * Last Editor: Syed Ashhad
     * Last Updated: February 2026
     */
    
    process(payload) {
        const { design, svgBuilder } = payload;

        // Parse colors from design
        const colors = this.parseColors(design);

        // Store parsed colors in payload for other processors
        payload.colors = colors;

        // If we have gradients, create gradient definitions
        if (colors.hasGradient) {
            const gradientId = this.createGradientDef(svgBuilder, design);
            payload.foregroundFill = `url(#${gradientId})`;
        } else {
            payload.foregroundFill = colors.foreground;
        }

        payload.backgroundColor = colors.background;
        payload.backgroundEnabled = colors.backgroundEnabled;

        this.log(`Colors applied: fg=${colors.foreground}, bg=${colors.background}, gradient=${colors.hasGradient}`);

        return payload;
    }

    /**
     * Purpose: Parse colors from design object
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    parseColors(design) {
        const foreground = this.normalizeColor(
            design.foregroundColor || design.foreground_color || design.fgColor || '#000000'
        );

        const background = this.normalizeColor(
            design.backgroundColor || design.background_color || design.bgColor || '#FFFFFF'
        );

        const eyeInternalColor = this.normalizeColor(
            design.eyeInternalColor || design.eye_internal_color || design.eyeInnerColor || foreground
        );

        const eyeExternalColor = this.normalizeColor(
            design.eyeExternalColor || design.eye_external_color || design.eyeOuterColor || foreground
        );

        const backgroundEnabled = design.backgroundEnabled !== false &&
            design.background_enabled !== false &&
            design.hasBackground !== false;

        // Check for gradient
        const fillType = design.fillType || design.fill_type || 'solid';
        const hasGradient = fillType === 'gradient' ||
            design.gradientFill ||
            design.gradient_fill ||
            design.gradient;

        return {
            foreground,
            background,
            eyeInternalColor,
            eyeExternalColor,
            backgroundEnabled,
            hasGradient,
            fillType
        };
    }

    /**
     * Purpose: Normalize a color value to a valid CSS color
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    normalizeColor(color) {
        if (!color) return '#000000';

        try {
            // If it's already a valid hex color, normalize it
            if (color.startsWith('#')) {
                // Expand shorthand hex (#RGB -> #RRGGBB)
                if (color.length === 4) {
                    color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
                }
                // Validate it's a proper hex
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    return color.toUpperCase();
                }
                if (/^#[0-9A-Fa-f]{8}$/.test(color)) {
                    return color.toUpperCase(); // 8-char hex with alpha
                }
            }

            // Try to parse with Color library for other formats
            const parsed = Color(color);
            return parsed.hex().toUpperCase();
        } catch (e) {
            // If parsing fails, return default black
            this.log(`Failed to parse color: ${color}, using default`, 'warn');
            return '#000000';
        }
    }

    /**
     * Purpose: Parse color to get RGBA components
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    parseColorComponents(color) {
        try {
            const parsed = Color(color);
            const rgb = parsed.rgb().object();
            return {
                r: Math.round(rgb.r),
                g: Math.round(rgb.g),
                b: Math.round(rgb.b),
                a: parsed.alpha()
            };
        } catch (e) {
            return { r: 0, g: 0, b: 0, a: 1 };
        }
    }

    /**
     * Purpose: Create gradient definition and return gradient ID
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    createGradientDef(svgBuilder, design) {
        const gradientConfig = design.gradientFill || design.gradient_fill || design.gradient || {};

        // Determine gradient type
        const type = (gradientConfig.type || 'LINEAR').toUpperCase();

        // Parse color stops
        const colors = this.parseGradientColors(gradientConfig.colors || gradientConfig.stops || [
            { color: '#000000', stop: 0 },
            { color: '#808080', stop: 50 },
            { color: '#000000', stop: 100 }
        ]);

        if (type === 'RADIAL') {
            return svgBuilder.createRadialGradient({
                id: 'qrGradient',
                cx: gradientConfig.cx || 50,
                cy: gradientConfig.cy || 50,
                r: gradientConfig.r || 50,
                fx: gradientConfig.fx,
                fy: gradientConfig.fy,
                colors
            });
        } else {
            // Linear gradient
            const angle = gradientConfig.angle || gradientConfig.direction || 45;

            return svgBuilder.createLinearGradient({
                id: 'qrGradient',
                angle: this.normalizeAngle(angle),
                colors
            });
        }
    }

    /**
     * Purpose: Parse gradient colors array
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    parseGradientColors(colors) {
        if (!Array.isArray(colors) || colors.length === 0) {
            return [
                { color: '#000000', stop: 0, opacity: 1 },
                { color: '#FFFFFF', stop: 100, opacity: 1 }
            ];
        }

        return colors.map((colorStop, index) => {
            // Handle different input formats
            let color, stop, opacity;

            if (typeof colorStop === 'string') {
                // Just a color string
                color = this.normalizeColor(colorStop);
                stop = (index / (colors.length - 1)) * 100;
                opacity = 1;
            } else if (typeof colorStop === 'object') {
                color = this.normalizeColor(colorStop.color || colorStop.value || '#000000');
                stop = colorStop.stop !== undefined ? colorStop.stop :
                    (colorStop.offset !== undefined ? colorStop.offset :
                        (colorStop.position !== undefined ? colorStop.position :
                            (index / (colors.length - 1)) * 100));
                opacity = colorStop.opacity !== undefined ? colorStop.opacity : 1;
            } else {
                color = '#000000';
                stop = (index / (colors.length - 1)) * 100;
                opacity = 1;
            }

            return { color, stop, opacity };
        });
    }

    /**
     * Purpose: Normalize angle to 0-360 range
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    normalizeAngle(angle) {
        // Handle string angles like "45deg"
        if (typeof angle === 'string') {
            angle = parseFloat(angle.replace('deg', ''));
        }

        // Handle named directions
        const namedAngles = {
            'to top': 0,
            'to right': 90,
            'to bottom': 180,
            'to left': 270,
            'to top right': 45,
            'to bottom right': 135,
            'to bottom left': 225,
            'to top left': 315
        };

        if (typeof angle === 'string' && namedAngles[angle.toLowerCase()]) {
            return namedAngles[angle.toLowerCase()];
        }

        // Normalize to 0-360
        const numAngle = parseFloat(angle) || 0;
        return ((numAngle % 360) + 360) % 360;
    }

    /**
     * Purpose: Generate contrasting color
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    getContrastColor(color) {
        try {
            const parsed = Color(color);
            // Use luminosity to determine if we need light or dark contrast
            if (parsed.luminosity() > 0.5) {
                return '#000000';
            } else {
                return '#FFFFFF';
            }
        } catch (e) {
            return '#000000';
        }
    }

    /**
     * Purpose: Lighten a color by percentage
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    lightenColor(color, amount = 20) {
        try {
            const parsed = Color(color);
            return parsed.lighten(amount / 100).hex();
        } catch (e) {
            return color;
        }
    }

    /**
     * Purpose: Darken a color by percentage
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    darkenColor(color, amount = 20) {
        try {
            const parsed = Color(color);
            return parsed.darken(amount / 100).hex();
        } catch (e) {
            return color;
        }
    }

    /**
     * Purpose: Mix two colors
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    mixColors(color1, color2, weight = 0.5) {
        try {
            const c1 = Color(color1);
            const c2 = Color(color2);
            return c1.mix(c2, 1 - weight).hex();
        } catch (e) {
            return color1;
        }
    }

    /**
     * Purpose: Check if color has transparency
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    hasTransparency(color) {
        try {
            const parsed = Color(color);
            return parsed.alpha() < 1;
        } catch (e) {
            return false;
        }
    }

    /**
     * Purpose: Get color with specified opacity
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    withOpacity(color, opacity) {
        try {
            const parsed = Color(color);
            return parsed.alpha(opacity).rgb().string();
        } catch (e) {
            return color;
        }
    }
}

module.exports = ColorProcessor;
