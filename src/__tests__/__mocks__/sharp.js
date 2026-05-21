/**
 * Manual mock for 'sharp' — replaces the native binary module in Jest tests.
 *
 * sharp is a native add-on that may not compile in all CI environments.
 * This mock returns a chainable object whose .png().toBuffer() resolves with
 * a valid 1×1 transparent PNG buffer so tests that exercise code paths
 * touching sharp don't fail on missing binaries.
 */

'use strict';

// Minimal valid 1×1 transparent PNG in base64
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

const sharpMock = jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    flatten: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(TINY_PNG),
    toFile: jest.fn().mockResolvedValue({ width: 1, height: 1, size: TINY_PNG.length }),
    metadata: jest.fn().mockResolvedValue({ width: 512, height: 512, format: 'png' }),
}));

sharpMock.TINY_PNG = TINY_PNG;

module.exports = sharpMock;
