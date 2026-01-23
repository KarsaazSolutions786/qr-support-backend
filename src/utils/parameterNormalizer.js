/**
 * Parameter Normalizer Utility
 * 
 * Normalizes parameters between Flutter and Laravel.
 * 
 * CRITICAL FIX: Laravel backend expects CAMEL CASE (camelCase) keys for design parameters.
 * This matches the web frontend structure. using snake_case BREAKS the backend processors.
 * 
 * This utility ensures all parameters are converted to camelCase before sending to Laravel.
 */

const logger = require('./logger');

/**
 * Convert a snake_case string to camelCase
 * @param {string} str - snake_case string
 * @returns {string} camelCase string
 */
function toCamelCase(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case
 * @param {string} str - camelCase string
 * @returns {string} snake_case string
 */
function toSnakeCase(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

/**
 * Mapping of common snake_case styles to their correct camelCase backend parameter names
 */
const DESIGN_PARAM_MAPPING = {
    // Module shapes
    modules_shape: 'module',
    module_shape: 'module',
    body_shape: 'module',
    modulesShape: 'module', // Normalize alias to correct key

    // Finder patterns
    finders_shape: 'finder',
    finder_shape: 'finder',
    eye_shape: 'finder',
    img_eye: 'finder',

    // Finder dots
    finders_dots_shape: 'finderDot',
    finder_dots_shape: 'finderDot',
    finder_dot_shape: 'finderDot',
    eye_dot_shape: 'finderDot',

    // Colors
    foreground_color: 'foregroundColor',
    background_color: 'backgroundColor',
    bg_color: 'backgroundColor',
    fg_color: 'foregroundColor',

    // Eye colors
    eye_internal_color: 'eyeInternalColor',
    eye_external_color: 'eyeExternalColor',
    eye_color: 'eyeColor',

    // Gradients
    gradient_type: 'gradientType',
    gradient_start_color: 'gradientStartColor',
    gradient_end_color: 'gradientEndColor',
    gradient_angle: 'gradientAngle',
    gradient_direction: 'gradientDirection',

    // Advanced shapes (stickers)
    advanced_shape: 'advancedShape',
    sticker: 'advancedShape',
    sticker_shape: 'advancedShape',

    // Themed shapes (outlined shapes)
    themed_shape: 'shape', // Backend uses 'shape' for outlined shapes
    outlined_shape: 'shape',

    // Frame/sticker options
    frame_text: 'text', // Backend uses 'text'
    frame_text_color: 'textColor',
    frame_color: 'frameColor',
    frame_background_color: 'textBackgroundColor',

    // Logo options
    logo_background_shape: 'logoBackgroundShape',
    logo_background_color: 'logoBackgroundColor',
    logo_size: 'logoScale', // Backend uses logoScale
    logo_margin: 'logoMargin',
    logo_padding: 'logoPadding',
    logo_url: 'logoUrl',
    logo_file: 'logoUrl',

    // Legacy mapping support (if Flutter sends keys that differ from backend expectation)
    gradientFill: 'gradientFill',
    modulesShape: 'module',
    findersShape: 'finder',
    findersDotsShape: 'finderDot',
};

/**
 * Recursively normalize object keys to camelCase (backend expectation)
 * @param {object} obj - Object with keys
 * @returns {object} Object with camelCase keys
 */
function normalizeToCamelCase(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => normalizeToCamelCase(item));
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    const normalized = {};

    for (const [key, value] of Object.entries(obj)) {
        // Use mapping if available, otherwise convert automatically
        // First check strict camelCase conversion
        let targetKey = toCamelCase(key);

        // Then check if this key (or its snake_case version) is in our special mapping
        const snakeKey = toSnakeCase(key);
        if (DESIGN_PARAM_MAPPING[snakeKey]) {
            targetKey = DESIGN_PARAM_MAPPING[snakeKey];
        } else if (DESIGN_PARAM_MAPPING[key]) {
            targetKey = DESIGN_PARAM_MAPPING[key];
        }

        // Recursively normalize nested objects
        normalized[targetKey] = normalizeToCamelCase(value);
    }

    return normalized;
}

/**
 * Normalize design parameters specifically for Laravel backend
 * Laravel expects CAMEL CASE keys (e.g. 'advancedShape', 'foregroundColor')
 * 
 * @param {object} design - Design object from Flutter
 * @returns {object} Normalized design object for Laravel (camelCase)
 */
function normalizeDesignForLaravel(design) {
    if (!design || typeof design !== 'object') {
        return design || {};
    }

    const normalized = normalizeToCamelCase(design);

    // Log the normalization for debugging
    logger.debug('Parameter normalization (to camelCase):', {
        original_keys: Object.keys(design).join(', '),
        normalized_keys: Object.keys(normalized).join(', '),
    });

    return normalized;
}

/**
 * Normalize complete request payload for Laravel
 * 
 * @param {object} payload - Full request payload
 * @returns {object} Normalized payload
 */
function normalizeRequestForLaravel(payload) {
    if (!payload || typeof payload !== 'object') {
        return payload || {};
    }

    const normalized = {
        type: payload.type,
        data: payload.data,
        // Normalize design to camelCase
        design: normalizeDesignForLaravel(payload.design || {}),
        size: payload.size,
        quality: payload.quality,
        format: payload.format || payload.output_format || 'svg',
        output_format: payload.format || payload.output_format || 'svg', // Send both to be safe
    };

    // Remove undefined values
    Object.keys(normalized).forEach(key => {
        if (normalized[key] === undefined) {
            delete normalized[key];
        }
    });

    return normalized;
}

/**
 * Check if a design parameter exists
 * 
 * @param {object} design - Design object
 * @param {string} key - Key name (camelCase or snake_case)
 * @returns {*} The value if found, undefined otherwise
 */
function getDesignParam(design, key) {
    if (!design) return undefined;

    // Check exact key
    if (design[key] !== undefined) return design[key];

    // Check camelCase
    const camelKey = toCamelCase(key);
    if (design[camelKey] !== undefined) return design[camelKey];

    // Check snake_case
    const snakeKey = toSnakeCase(key);
    if (design[snakeKey] !== undefined) return design[snakeKey];

    return undefined;
}

module.exports = {
    toSnakeCase,
    toCamelCase,
    normalizeToCamelCase,
    normalizeDesignForLaravel,
    normalizeRequestForLaravel,
    getDesignParam,
    DESIGN_PARAM_MAPPING,
};
