/**
 * Tests for CacheService
 *
 * CacheService is a singleton that depends on Redis (ioredis) at construction time.
 * We mock ioredis so tests run without a live Redis connection and exercise the
 * in-memory fallback path as well as the generateKey helper.
 */

jest.mock('ioredis');

const crypto = require('crypto');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Fresh CacheService instance for each test group.
 * Jest module registry is reset between describe blocks via jest.resetModules().
 */
function freshCacheService(env = {}) {
    const saved = {};
    const keys = ['CACHE_ENABLED', 'CACHE_TTL', 'REDIS_HOST', 'REDIS_PORT'];

    // Apply overrides
    keys.forEach(k => {
        saved[k] = process.env[k];
        if (env[k] !== undefined) process.env[k] = env[k];
        else delete process.env[k];
    });

    jest.resetModules();
    const service = require('../services/cacheService');

    // Restore env
    keys.forEach(k => {
        if (saved[k] !== undefined) process.env[k] = saved[k];
        else delete process.env[k];
    });

    return service;
}

// ── generateKey ───────────────────────────────────────────────────────────────

describe('CacheService.generateKey', () => {
    let cache;

    beforeEach(() => {
        cache = freshCacheService({ CACHE_ENABLED: 'false' });
    });

    test('returns a key prefixed with qr_support:', () => {
        const key = cache.generateKey({ type: 'url', size: 512 });
        expect(key).toMatch(/^qr_support:/);
    });

    test('uses SHA-256 hash (64 hex chars after prefix)', () => {
        const key = cache.generateKey({ type: 'url', size: 512 });
        const hash = key.replace('qr_support:', '');
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    test('produces consistent key for same params', () => {
        const params = { type: 'wifi', ssid: 'test', size: 256 };
        expect(cache.generateKey(params)).toBe(cache.generateKey(params));
    });

    test('produces different keys for different params', () => {
        const k1 = cache.generateKey({ type: 'url', size: 512 });
        const k2 = cache.generateKey({ type: 'url', size: 256 });
        expect(k1).not.toBe(k2);
    });

    test('hash matches manual SHA-256 of JSON.stringify(params)', () => {
        const params = { type: 'email', address: 'test@example.com' };
        const expected = crypto
            .createHash('sha256')
            .update(JSON.stringify(params))
            .digest('hex');
        const key = cache.generateKey(params);
        expect(key).toBe(`qr_support:${expected}`);
    });
});

// ── cache disabled ────────────────────────────────────────────────────────────

describe('CacheService with caching disabled', () => {
    let cache;

    beforeEach(() => {
        cache = freshCacheService({ CACHE_ENABLED: 'false' });
    });

    test('get() returns null when cache is disabled', async () => {
        await expect(cache.get('any-key')).resolves.toBeNull();
    });

    test('set() resolves without error when cache is disabled', async () => {
        await expect(cache.set('any-key', Buffer.from('data'))).resolves.toBeUndefined();
    });
});

// ── in-memory cache (Redis unavailable) ─────────────────────────────────────

describe('CacheService in-memory fallback', () => {
    let cache;

    beforeEach(() => {
        // Enable cache but no Redis env → ioredis mock will be constructed.
        // We force redis to null after construction to exercise memory-cache path.
        cache = freshCacheService({ CACHE_ENABLED: 'true', CACHE_TTL: '60' });
        // Forcibly disable the Redis instance so the memory path is used.
        cache.redis = null;
    });

    test('get() returns null on cache miss', async () => {
        const result = await cache.get('qr_support:nonexistent');
        expect(result).toBeNull();
    });

    test('set() stores and get() retrieves a Buffer value', async () => {
        const key = 'qr_support:test-buffer';
        const value = Buffer.from('hello-qr');

        await cache.set(key, value);
        const retrieved = await cache.get(key);

        expect(retrieved).toEqual(value);
    });

    test('set() stores and get() retrieves a string value', async () => {
        const key = 'qr_support:test-string';
        const value = '{"png_base64":"abc123"}';

        await cache.set(key, value);
        const retrieved = await cache.get(key);

        expect(retrieved).toBe(value);
    });

    test('get() returns null for expired entry', async () => {
        // Use a 1-second TTL and fast-forward the stored timestamp
        cache.ttl = 1;
        const key = 'qr_support:expired';
        await cache.set(key, 'stale-value');

        // Manually age the timestamp past the TTL
        cache.memoryCacheTimestamps.set(key, Date.now() - 2000);

        const result = await cache.get(key);
        expect(result).toBeNull();
    });

    test('get() removes the expired entry from memoryCache', async () => {
        cache.ttl = 1;
        const key = 'qr_support:expired-cleanup';
        await cache.set(key, 'old');
        cache.memoryCacheTimestamps.set(key, Date.now() - 2000);

        await cache.get(key);

        expect(cache.memoryCache.has(key)).toBe(false);
        expect(cache.memoryCacheTimestamps.has(key)).toBe(false);
    });

    test('delete() removes a stored entry', async () => {
        const key = 'qr_support:to-delete';
        await cache.set(key, 'value');
        await cache.delete(key);

        const result = await cache.get(key);
        expect(result).toBeNull();
    });

    test('clearPrefix() removes all matching keys', async () => {
        await cache.set('qr_support:a1', 'v1');
        await cache.set('qr_support:a2', 'v2');
        await cache.set('other:b1', 'v3');

        await cache.clearPrefix('qr_support:');

        expect(await cache.get('qr_support:a1')).toBeNull();
        expect(await cache.get('qr_support:a2')).toBeNull();
        // Key with a different prefix should survive
        expect(cache.memoryCache.has('other:b1')).toBe(true);
    });
});
