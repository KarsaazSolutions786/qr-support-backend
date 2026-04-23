/**
 * Cache Service
 *
 * Provides caching functionality using Redis for rendered PNG images.
 * Falls back to in-memory cache if Redis is unavailable.
 */

const Redis = require('ioredis');
const crypto = require('crypto');
const zlib = require('zlib');
const logger = require('../utils/logger');

// Gzip magic bytes: 0x1f 0x8b
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

/**
 * Compress a Buffer with gzip before storing in Redis.
 * Strings are returned as-is (they are already compact JSON).
 *
 * @param {Buffer|string} value
 * @returns {Buffer|string}
 */
function compressForCache(value) {
    if (Buffer.isBuffer(value)) {
        try {
            return zlib.gzipSync(value);
        } catch (err) {
            logger.warn('Cache compress error (storing raw): ' + err.message);
            return value;
        }
    }
    return value;
}

/**
 * Decompress a value retrieved from Redis.
 * Detects gzip magic bytes and gunzips; otherwise returns value unchanged.
 *
 * @param {Buffer|string|null} value
 * @returns {Buffer|string|null}
 */
function decompressFromCache(value) {
    if (Buffer.isBuffer(value) && value.length >= 2 &&
        value[0] === GZIP_MAGIC_0 && value[1] === GZIP_MAGIC_1) {
        try {
            return zlib.gunzipSync(value);
        } catch (err) {
            logger.warn('Cache decompress error (returning raw): ' + err.message);
            return value;
        }
    }
    return value;
}

class CacheService {
    constructor() {
        this.enabled = process.env.CACHE_ENABLED === 'true';
        this.ttl = parseInt(process.env.CACHE_TTL) || 300;
        this.redis = null;
        this.memoryCache = new Map();
        this.memoryCacheTimestamps = new Map();

        if (this.enabled) {
            this.initRedis();
        }
    }

    /**
     * Initialize Redis connection
     */
    initRedis() {
        try {
            this.redis = new Redis({
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB) || 1,
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.warn('Redis connection failed, falling back to memory cache');
                        this.redis = null;
                        return null;
                    }
                    return Math.min(times * 200, 2000);
                },
            });

            this.redis.on('connect', () => {
                logger.info('Redis connected successfully');
            });

            this.redis.on('error', (err) => {
                logger.warn(`Redis error: ${err.message}`);
            });
        } catch (error) {
            logger.warn(`Redis initialization failed: ${error.message}, using memory cache`);
            this.redis = null;
        }
    }

    /**
     * Generate cache key from parameters
     */
    generateKey(params) {
        const hash = crypto
            .createHash('sha256')
            .update(JSON.stringify(params))
            .digest('hex');
        return `qr_support:${hash}`;
    }

    /**
     * Get value from cache
     *
     * @param {string} key - Cache key
     * @returns {Promise<Buffer|null>} Cached value or null
     */
    async get(key) {
        if (!this.enabled) return null;

        try {
            if (this.redis) {
                const raw = await this.redis.getBuffer(key);
                if (raw) {
                    logger.debug(`Cache hit (Redis): ${key}`);
                    return decompressFromCache(raw);
                }
            } else {
                // Memory cache fallback
                if (this.memoryCache.has(key)) {
                    const timestamp = this.memoryCacheTimestamps.get(key);
                    if (Date.now() - timestamp < this.ttl * 1000) {
                        logger.debug(`Cache hit (Memory): ${key}`);
                        return this.memoryCache.get(key);
                    } else {
                        // Expired
                        this.memoryCache.delete(key);
                        this.memoryCacheTimestamps.delete(key);
                    }
                }
            }
        } catch (error) {
            logger.warn(`Cache get error: ${error.message}`);
        }

        logger.debug(`Cache miss: ${key}`);
        return null;
    }

    /**
     * Set value in cache
     *
     * @param {string} key - Cache key
     * @param {Buffer|string} value - Value to cache
     * @param {number} ttl - TTL in seconds (optional)
     */
    async set(key, value, ttl = null) {
        if (!this.enabled) return;

        const cacheTtl = ttl || this.ttl;

        try {
            if (this.redis) {
                // Compress Buffer values (PNG data) before storage to save ~60% Redis memory.
                // String values (JSON) are stored as-is — they compress poorly without context.
                const stored = compressForCache(value);
                await this.redis.setex(key, cacheTtl, stored);
                logger.debug(`Cache set (Redis): ${key}, TTL: ${cacheTtl}s`);
            } else {
                // Memory cache fallback
                this.memoryCache.set(key, value);
                this.memoryCacheTimestamps.set(key, Date.now());
                logger.debug(`Cache set (Memory): ${key}`);

                // Clean up expired entries if memory cache gets too big
                if (this.memoryCache.size > 1000) {
                    this.cleanupMemoryCache();
                }

                // Hard cap: LRU eviction (Map preserves insertion order)
                const MAX_MEMORY_ENTRIES = 500;
                if (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
                    const keysToRemove = [...this.memoryCache.keys()]
                        .slice(0, this.memoryCache.size - MAX_MEMORY_ENTRIES);
                    keysToRemove.forEach(k => {
                        this.memoryCache.delete(k);
                        this.memoryCacheTimestamps.delete(k);
                    });
                    logger.debug(`LRU eviction: removed ${keysToRemove.length} entries`);
                }
            }
        } catch (error) {
            logger.warn(`Cache set error: ${error.message}`);
        }
    }

    /**
     * Delete value from cache
     *
     * @param {string} key - Cache key
     */
    async delete(key) {
        try {
            if (this.redis) {
                await this.redis.del(key);
            } else {
                this.memoryCache.delete(key);
                this.memoryCacheTimestamps.delete(key);
            }
            logger.debug(`Cache delete: ${key}`);
        } catch (error) {
            logger.warn(`Cache delete error: ${error.message}`);
        }
    }

    /**
     * Clear all cache entries with prefix
     *
     * @param {string} prefix - Key prefix to clear
     */
    async clearPrefix(prefix) {
        try {
            if (this.redis) {
                let cleared = 0;
                let cursor = '0';
                do {
                    const result = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
                    cursor = result[0];
                    const keys = result[1];
                    if (keys.length > 0) {
                        await this.redis.del(...keys);
                        cleared += keys.length;
                    }
                } while (cursor !== '0');
                if (cleared > 0) {
                    logger.info(`Cleared ${cleared} cache entries with prefix: ${prefix}`);
                }
            } else {
                let count = 0;
                for (const key of this.memoryCache.keys()) {
                    if (key.startsWith(prefix)) {
                        this.memoryCache.delete(key);
                        this.memoryCacheTimestamps.delete(key);
                        count++;
                    }
                }
                if (count > 0) {
                    logger.info(`Cleared ${count} memory cache entries with prefix: ${prefix}`);
                }
            }
        } catch (error) {
            logger.warn(`Cache clear error: ${error.message}`);
        }
    }

    /**
     * Clean up expired entries in memory cache
     */
    cleanupMemoryCache() {
        const now = Date.now();
        const ttlMs = this.ttl * 1000;
        let cleaned = 0;

        for (const [key, timestamp] of this.memoryCacheTimestamps.entries()) {
            if (now - timestamp > ttlMs) {
                this.memoryCache.delete(key);
                this.memoryCacheTimestamps.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} expired memory cache entries`);
        }
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        const stats = {
            enabled: this.enabled,
            type: this.redis ? 'redis' : 'memory',
            ttl: this.ttl,
        };

        try {
            if (this.redis) {
                const info = await this.redis.info('memory');
                const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1];
                stats.memory = usedMemory;
                stats.connected = true;
            } else {
                stats.entries = this.memoryCache.size;
                stats.connected = false;
            }
        } catch (error) {
            logger.error(`Cache stats error: ${error.message}`);
            stats.error = 'Failed to retrieve cache stats.';
        }

        return stats;
    }
}

module.exports = new CacheService();
