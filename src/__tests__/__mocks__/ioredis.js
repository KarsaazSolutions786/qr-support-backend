/**
 * Manual mock for 'ioredis' — prevents real Redis connections in tests.
 *
 * All commands resolve immediately with null / 'OK' so cacheService
 * behaves as a no-op cache (cache miss on every get).
 */

'use strict';

const EventEmitter = require('events');

class RedisMock extends EventEmitter {
    constructor() {
        super();
        this.store = new Map();
        // Emit 'connect' on next tick so event listeners are attached first
        process.nextTick(() => this.emit('connect'));
    }

    async get(key) {
        return this.store.get(key) ?? null;
    }

    async set(key, value, ...args) {
        this.store.set(key, value);
        return 'OK';
    }

    async del(key) {
        const existed = this.store.has(key);
        this.store.delete(key);
        return existed ? 1 : 0;
    }

    async expire(key, seconds) {
        return 1;
    }

    async ttl(key) {
        return -1;
    }

    async flushdb() {
        this.store.clear();
        return 'OK';
    }

    async ping() {
        return 'PONG';
    }

    async quit() {
        return 'OK';
    }

    async disconnect() {
        return undefined;
    }
}

module.exports = RedisMock;
