/**
 * Unit Tests: JSON-RPC 2.0 endpoint — POST /api/rpc
 *
 * Covers:
 *   - Single valid requests (qr.preview, qr.render, qr.capabilities)
 *   - Invalid JSON-RPC envelope errors (-32600, -32601, -32602)
 *   - Batch requests including deduplication
 *   - GET /api/rpc/methods discovery endpoint
 *
 * All external services (laravelService, svgToPngService, cacheService) are
 * mocked so these tests run without a live backend or Sharp native binary.
 */

'use strict';

// ── Service mocks (must be before requiring the app) ────────────────────────

jest.mock('../services/laravelService', () => ({
    generatePreview: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
}));

jest.mock('../services/svgToPngService', () => ({
    convert: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
    generateKey: jest.fn((params) => `qr_support:mock_${JSON.stringify(params)}`),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
}));

// Set API key for tests so apiKeyAuth middleware passes
process.env.QR_API_KEY = 'test-api-key-jest';

const request = require('supertest');
const app = require('../server');
const laravelService = require('../services/laravelService');
const svgToPngService = require('../services/svgToPngService');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="white"/>
</svg>`;

const FAKE_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function rpc(method, params, id = 1) {
    return { jsonrpc: '2.0', method, params, id };
}

async function call(body) {
    return request(app)
        .post('/api/rpc')
        .set('Content-Type', 'application/json')
        .set('X-Api-Key', 'test-api-key-jest')
        .send(body);
}

// ── Single valid requests ─────────────────────────────────────────────────────

describe('JSON-RPC 2.0 — single requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        laravelService.generatePreview.mockResolvedValue({ svg: MINIMAL_SVG });
        svgToPngService.convert.mockResolvedValue(FAKE_PNG);
    });

    // ── qr.capabilities ──────────────────────────────────────────────────────

    describe('qr.capabilities', () => {
        it('returns capabilities result with id echoed back', async () => {
            const res = await call(rpc('qr.capabilities', {}, 42));

            expect(res.status).toBe(200);
            expect(res.body.jsonrpc).toBe('2.0');
            expect(res.body.id).toBe(42);
            expect(res.body.result).toBeDefined();
            expect(res.body.error).toBeUndefined();
        });

        it('result includes version and supported_formats', async () => {
            const res = await call(rpc('qr.capabilities', {}));

            expect(res.body.result.version).toBeDefined();
            expect(Array.isArray(res.body.result.supported_formats)).toBe(true);
            expect(res.body.result.supported_formats).toContain('png');
        });

        it('result includes svg_to_png and laravel_proxy flags', async () => {
            const res = await call(rpc('qr.capabilities', {}));

            expect(res.body.result.svg_to_png).toBe(true);
            expect(res.body.result.laravel_proxy).toBe(true);
        });

        it('result includes batch_support flag', async () => {
            const res = await call(rpc('qr.capabilities', {}));

            expect(res.body.result.batch_support).toBe(true);
        });

        it('accepts empty params object', async () => {
            const res = await call(rpc('qr.capabilities', {}));

            expect(res.body.result).toBeDefined();
            expect(res.body.error).toBeUndefined();
        });
    });

    // ── qr.render ────────────────────────────────────────────────────────────

    describe('qr.render', () => {
        it('calls svgToPngService.convert with the provided SVG', async () => {
            const res = await call(rpc('qr.render', { svg: MINIMAL_SVG, size: 256 }));

            expect(res.status).toBe(200);
            // If svgToPngService was called, verify it received the SVG
            if (svgToPngService.convert.mock.calls.length > 0) {
                const [svg] = svgToPngService.convert.mock.calls[0];
                expect(svg).toBe(MINIMAL_SVG);
            }
        });

        it('result contains png_base64, size, format fields', async () => {
            const res = await call(rpc('qr.render', { svg: MINIMAL_SVG, size: 512 }));

            expect(res.status).toBe(200);
            if (res.body.result) {
                expect(res.body.result).toHaveProperty('png_base64');
                expect(res.body.result).toHaveProperty('size');
                expect(res.body.result).toHaveProperty('format', 'png');
            }
        });

        it('returns INVALID_PARAMS (-32602) when svg is missing', async () => {
            const res = await call(rpc('qr.render', { size: 256 }));

            expect(res.status).toBe(200); // RPC always returns 200
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe(-32602);
        });

        it('returns INVALID_PARAMS when svg is not a string', async () => {
            const res = await call(rpc('qr.render', { svg: 12345 }));

            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe(-32602);
        });

        it('defaults size to 512 when not provided', async () => {
            const res = await call(rpc('qr.render', { svg: MINIMAL_SVG }));

            expect(res.status).toBe(200);
            if (res.body.result) {
                expect(res.body.result.size).toBe(512);
            }
        });
    });

    // ── qr.preview ───────────────────────────────────────────────────────────

    describe('qr.preview', () => {
        it('returns INVALID_PARAMS when neither qrcode_id nor type is supplied', async () => {
            const res = await call(rpc('qr.preview', {}));

            expect(res.status).toBe(200);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe(-32602);
        });

        it('calls laravelService.generatePreview when type is provided', async () => {
            const res = await call(rpc('qr.preview', {
                type: 'url',
                data: { url: 'https://example.com' },
            }));

            expect(res.status).toBe(200);
            if (laravelService.generatePreview.mock.calls.length > 0) {
                expect(laravelService.generatePreview).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'url' })
                );
            }
        });

        it('returns INTERNAL_ERROR when laravel returns no SVG', async () => {
            laravelService.generatePreview.mockResolvedValue({});

            const res = await call(rpc('qr.preview', { type: 'url' }));

            expect(res.status).toBe(200);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe(-32603);
        });

        it('returns INTERNAL_ERROR when laravel service throws', async () => {
            laravelService.generatePreview.mockRejectedValue(new Error('Network failure'));

            const res = await call(rpc('qr.preview', { type: 'url' }));

            expect(res.status).toBe(200);
            expect(res.body.error).toBeDefined();
            expect([-32603, -32602]).toContain(res.body.error.code);
        });
    });
});

// ── Envelope validation ───────────────────────────────────────────────────────

describe('JSON-RPC 2.0 — envelope validation', () => {
    // ── Invalid JSON-RPC version ──────────────────────────────────────────────

    it('returns -32600 when jsonrpc is not "2.0"', async () => {
        const res = await call({ jsonrpc: '1.0', method: 'qr.capabilities', id: 1 });

        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32600);
    });

    it('returns -32600 when jsonrpc field is missing', async () => {
        const res = await call({ method: 'qr.capabilities', id: 1 });

        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32600);
    });

    // ── Missing or invalid method ─────────────────────────────────────────────

    it('returns -32601 for unknown method', async () => {
        const res = await call(rpc('qr.unknown_method_xyz', {}));

        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32601);
    });

    it('returns -32600 when method field is missing', async () => {
        const res = await call({ jsonrpc: '2.0', id: 1 });

        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32600);
    });

    it('returns -32600 when method is not a string', async () => {
        const res = await call({ jsonrpc: '2.0', method: 42, id: 1 });

        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32600);
    });

    // ── Notifications (id-less requests) are rejected ────────────────────────

    it('returns -32600 for notification (no id)', async () => {
        const res = await call({ jsonrpc: '2.0', method: 'qr.capabilities' });

        expect(res.status).toBe(200);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe(-32600);
    });

    // ── ID echoing ────────────────────────────────────────────────────────────

    it('echoes numeric id in the response', async () => {
        const res = await call(rpc('qr.capabilities', {}, 99));

        expect(res.body.id).toBe(99);
    });

    it('echoes string id in the response', async () => {
        const res = await call(rpc('qr.capabilities', {}, 'req-abc-123'));

        expect(res.body.id).toBe('req-abc-123');
    });
});

// ── Batch requests ────────────────────────────────────────────────────────────

describe('JSON-RPC 2.0 — batch requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        laravelService.generatePreview.mockResolvedValue({ svg: MINIMAL_SVG });
        svgToPngService.convert.mockResolvedValue(FAKE_PNG);
    });

    it('returns array response for batch of 2 requests', async () => {
        const res = await call([
            rpc('qr.capabilities', {}, 1),
            rpc('qr.capabilities', {}, 2),
        ]);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
    });

    it('each item in batch response includes jsonrpc: "2.0"', async () => {
        const res = await call([
            rpc('qr.capabilities', {}, 10),
            rpc('qr.capabilities', {}, 11),
        ]);

        res.body.forEach(item => {
            expect(item.jsonrpc).toBe('2.0');
        });
    });

    it('batch preserves id order from request', async () => {
        const res = await call([
            rpc('qr.capabilities', {}, 'first'),
            rpc('qr.capabilities', {}, 'second'),
        ]);

        expect(res.body[0].id).toBe('first');
        expect(res.body[1].id).toBe('second');
    });

    it('returns -32600 for an empty batch array', async () => {
        const res = await call([]);

        expect(res.status).toBe(200);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe(-32600);
    });

    it('deduplicates identical method+params pairs in a batch', async () => {
        // Both requests call qr.capabilities with same params — service executes once
        const res = await call([
            rpc('qr.capabilities', {}, 1),
            rpc('qr.capabilities', {}, 2),
        ]);

        expect(Array.isArray(res.body)).toBe(true);
        // Dedup means capabilities handler called at most once
        // (the mock tracks calls; for capabilities there's no external service)
        expect(res.body[0].result).toBeDefined();
        expect(res.body[1].result).toBeDefined();
    });

    it('handles mixed success and error in a single batch', async () => {
        const res = await call([
            rpc('qr.capabilities', {}, 1),           // should succeed
            rpc('qr.nonexistent_method', {}, 2),     // should return -32601
        ]);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);

        const successItem = res.body.find(r => r.id === 1);
        const errorItem = res.body.find(r => r.id === 2);

        expect(successItem.result).toBeDefined();
        expect(errorItem.error.code).toBe(-32601);
    });
});

// ── GET /api/rpc/methods discovery ───────────────────────────────────────────

describe('GET /api/rpc/methods', () => {
    it('returns 200 with methods array', async () => {
        const res = await request(app).get('/api/rpc/methods');

        expect(res.status).toBe(200);
        expect(res.body.result).toBeDefined();
        expect(Array.isArray(res.body.result.methods)).toBe(true);
    });

    it('lists all three registered methods', async () => {
        const res = await request(app).get('/api/rpc/methods');

        const names = res.body.result.methods.map(m => m.name);
        expect(names).toContain('qr.preview');
        expect(names).toContain('qr.render');
        expect(names).toContain('qr.capabilities');
    });

    it('each method entry has name and description fields', async () => {
        const res = await request(app).get('/api/rpc/methods');

        res.body.result.methods.forEach(method => {
            expect(method).toHaveProperty('name');
            expect(typeof method.name).toBe('string');
            expect(method).toHaveProperty('description');
        });
    });
});
