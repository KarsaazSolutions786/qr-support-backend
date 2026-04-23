/**
 * Manual mock for 'color' — the color v5 package is pure ESM and cannot be
 * required() by Jest's CommonJS transform. This CJS stub provides the small
 * subset of the Color API used by ColorProcessor so the integration/rpc tests
 * can load server.js without a transform error.
 */

'use strict';

class Color {
    constructor(value) {
        this._value = value || '#000000';
    }

    hex() {
        return typeof this._value === 'string' ? this._value.toUpperCase() : '#000000';
    }

    rgb() {
        return {
            r: 0, g: 0, b: 0,
            array: () => [0, 0, 0],
            string: () => 'rgb(0,0,0)',
        };
    }

    alpha(a) {
        if (a === undefined) return 1;
        return new Color(this._value);
    }

    darken(ratio) {
        return new Color(this._value);
    }

    lighten(ratio) {
        return new Color(this._value);
    }

    isLight() {
        return true;
    }

    isDark() {
        return false;
    }

    toString() {
        return this._value || '#000000';
    }
}

module.exports = Color;
