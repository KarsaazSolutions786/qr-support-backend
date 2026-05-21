/**
 * Tests for parameterNormalizer utility
 *
 * Covers: toCamelCase, toSnakeCase, normalizeToCamelCase,
 *         normalizeDesignForLaravel, normalizeRequestForLaravel, getDesignParam
 */

const {
    toCamelCase,
    toSnakeCase,
    normalizeToCamelCase,
    normalizeDesignForLaravel,
    normalizeRequestForLaravel,
    getDesignParam,
    DESIGN_PARAM_MAPPING,
} = require('../utils/parameterNormalizer');

// ── toCamelCase ───────────────────────────────────────────────────────────────

describe('toCamelCase', () => {
    test('converts snake_case to camelCase', () => {
        expect(toCamelCase('foreground_color')).toBe('foregroundColor');
    });

    test('leaves already-camelCase strings unchanged', () => {
        expect(toCamelCase('foregroundColor')).toBe('foregroundColor');
    });

    test('handles single-word strings', () => {
        expect(toCamelCase('module')).toBe('module');
    });

    test('converts multi-segment snake_case', () => {
        expect(toCamelCase('gradient_start_color')).toBe('gradientStartColor');
    });

    test('returns non-string inputs unchanged', () => {
        expect(toCamelCase(null)).toBeNull();
        expect(toCamelCase(undefined)).toBeUndefined();
        expect(toCamelCase(42)).toBe(42);
    });
});

// ── toSnakeCase ───────────────────────────────────────────────────────────────

describe('toSnakeCase', () => {
    test('converts camelCase to snake_case', () => {
        expect(toSnakeCase('foregroundColor')).toBe('foreground_color');
    });

    test('leaves already-snake_case strings unchanged', () => {
        expect(toSnakeCase('foreground_color')).toBe('foreground_color');
    });

    test('does not add leading underscore', () => {
        expect(toSnakeCase('Module')).toBe('module');
    });

    test('handles multi-word camelCase', () => {
        expect(toSnakeCase('gradientStartColor')).toBe('gradient_start_color');
    });

    test('returns non-string inputs unchanged', () => {
        expect(toSnakeCase(null)).toBeNull();
        expect(toSnakeCase(undefined)).toBeUndefined();
    });
});

// ── normalizeToCamelCase ──────────────────────────────────────────────────────

describe('normalizeToCamelCase', () => {
    test('converts top-level snake_case keys', () => {
        const result = normalizeToCamelCase({ foreground_color: '#000', background_color: '#fff' });
        expect(result).toHaveProperty('foregroundColor', '#000');
        expect(result).toHaveProperty('backgroundColor', '#fff');
    });

    test('applies DESIGN_PARAM_MAPPING overrides', () => {
        // modules_shape → 'module' (not 'modulesShape')
        const result = normalizeToCamelCase({ modules_shape: 'dots' });
        expect(result).toHaveProperty('module', 'dots');
    });

    test('recursively normalizes nested objects', () => {
        const result = normalizeToCamelCase({
            gradient_fill: { gradient_type: 'linear', gradient_angle: 45 },
        });
        expect(result).toHaveProperty('gradientFill');
        expect(result.gradientFill).toHaveProperty('gradientType', 'linear');
        expect(result.gradientFill).toHaveProperty('gradientAngle', 45);
    });

    test('handles array values without breaking', () => {
        const result = normalizeToCamelCase({ color_list: ['#fff', '#000'] });
        expect(result.colorList).toEqual(['#fff', '#000']);
    });

    test('passes through null and undefined', () => {
        expect(normalizeToCamelCase(null)).toBeNull();
        expect(normalizeToCamelCase(undefined)).toBeUndefined();
    });

    test('passes through primitive values unchanged', () => {
        expect(normalizeToCamelCase('string')).toBe('string');
        expect(normalizeToCamelCase(42)).toBe(42);
    });
});

// ── normalizeDesignForLaravel ─────────────────────────────────────────────────

describe('normalizeDesignForLaravel', () => {
    test('normalizes a full Flutter design payload to camelCase', () => {
        const design = {
            modules_shape: 'dots',
            finders_shape: 'rounded',
            foreground_color: '#1a1a1a',
            background_color: '#ffffff',
            logo_url: 'https://example.com/logo.png',
        };

        const result = normalizeDesignForLaravel(design);

        expect(result).toHaveProperty('module', 'dots');
        expect(result).toHaveProperty('finder', 'rounded');
        expect(result).toHaveProperty('foregroundColor', '#1a1a1a');
        expect(result).toHaveProperty('backgroundColor', '#ffffff');
        expect(result).toHaveProperty('logoUrl', 'https://example.com/logo.png');
    });

    test('returns empty object for falsy input', () => {
        expect(normalizeDesignForLaravel(null)).toEqual({});
        expect(normalizeDesignForLaravel(undefined)).toEqual({});
    });

    test('passes through already-camelCase keys', () => {
        const design = { foregroundColor: '#ff0000' };
        const result = normalizeDesignForLaravel(design);
        expect(result).toHaveProperty('foregroundColor', '#ff0000');
    });
});

// ── normalizeRequestForLaravel ────────────────────────────────────────────────

describe('normalizeRequestForLaravel', () => {
    test('normalizes a complete request payload', () => {
        const payload = {
            type: 'url',
            data: { url: 'https://example.com' },
            design: {
                foreground_color: '#000000',
                modules_shape: 'rounded',
            },
            size: 512,
            quality: 90,
        };

        const result = normalizeRequestForLaravel(payload);

        expect(result.type).toBe('url');
        expect(result.data).toEqual({ url: 'https://example.com' });
        expect(result.size).toBe(512);
        expect(result.quality).toBe(90);
        expect(result.design).toHaveProperty('foregroundColor', '#000000');
        expect(result.design).toHaveProperty('module', 'rounded');
    });

    test('defaults format and output_format to svg', () => {
        const result = normalizeRequestForLaravel({ type: 'text', data: { text: 'hi' } });
        expect(result.format).toBe('svg');
        expect(result.output_format).toBe('svg');
    });

    test('uses explicit format when provided', () => {
        const result = normalizeRequestForLaravel({ type: 'text', data: {}, format: 'png' });
        expect(result.format).toBe('png');
        expect(result.output_format).toBe('png');
    });

    test('strips undefined fields', () => {
        const result = normalizeRequestForLaravel({ type: 'url', data: {} });
        expect(Object.keys(result)).not.toContain('size');
        expect(Object.keys(result)).not.toContain('quality');
    });

    test('returns empty object for falsy input', () => {
        expect(normalizeRequestForLaravel(null)).toEqual({});
        expect(normalizeRequestForLaravel(undefined)).toEqual({});
    });
});

// ── getDesignParam ────────────────────────────────────────────────────────────

describe('getDesignParam', () => {
    const design = {
        foregroundColor: '#ff0000',
        background_color: '#ffffff',
    };

    test('finds an exact key', () => {
        expect(getDesignParam(design, 'foregroundColor')).toBe('#ff0000');
    });

    test('finds a camelCase equivalent of a snake_case lookup key', () => {
        // looking up 'foreground_color' should find 'foregroundColor'
        expect(getDesignParam(design, 'foreground_color')).toBe('#ff0000');
    });

    test('finds a snake_case key directly', () => {
        expect(getDesignParam(design, 'background_color')).toBe('#ffffff');
    });

    test('returns undefined for a missing key', () => {
        expect(getDesignParam(design, 'logoUrl')).toBeUndefined();
    });

    test('returns undefined for a null design', () => {
        expect(getDesignParam(null, 'foregroundColor')).toBeUndefined();
    });
});

// ── DESIGN_PARAM_MAPPING sanity checks ────────────────────────────────────────

describe('DESIGN_PARAM_MAPPING', () => {
    test('maps modules_shape to module', () => {
        expect(DESIGN_PARAM_MAPPING['modules_shape']).toBe('module');
    });

    test('maps finders_shape to finder', () => {
        expect(DESIGN_PARAM_MAPPING['finders_shape']).toBe('finder');
    });

    test('maps logo_size to logoScale', () => {
        expect(DESIGN_PARAM_MAPPING['logo_size']).toBe('logoScale');
    });

    test('maps advanced_shape to advancedShape', () => {
        expect(DESIGN_PARAM_MAPPING['advanced_shape']).toBe('advancedShape');
    });
});
