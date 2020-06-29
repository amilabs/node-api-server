const assert = require('assert');
const { TimeCounters } = require('../../src/redis/timecounters');

class RedisMultyMock {
    constructor() {
        this.hmsetFunc = () => {};
        this.hmsetCnt = 0;
        this.hdelFunc = () => {};
        this.hdelCnt = 0;
    }

    hmset(...args) {
        this.hmsetCnt++;
        return this.hmsetFunc(...args);
    }

    hdel(...args) {
        this.hdelCnt++;
        return this.hdelFunc(...args);
    }

    exec(callback) {
        callback(null);
    }
}

class RedisMock {
    constructor() {
        this.hincrbyAsyncFunc = () => true;
        this.hincrbyAsyncCnt = 0;
        this.hgetallAsyncFunc = () => ({});
        this.hgetallAsyncCnt = 0;
        this.expireAsyncFunc = () => true;
        this.expireAsyncCnt = 0;
        this.multiCnt = 0;
    }

    async hincrbyAsync(...args) {
        this.hincrbyAsyncCnt++;
        return this.hincrbyAsyncFunc(...args);
    }

    async expireAsync(...args) {
        this.expireAsyncCnt++;
        return this.expireAsyncFunc(...args);
    }

    async hgetallAsync(...args) {
        this.hgetallAsyncCnt++;
        return this.hgetallAsyncFunc(...args);
    }

    multi() {
        this.multiCnt++;
        return new RedisMultyMock();
    }
}

describe('TimeCounters', () => {
    describe('constructor', () => {
        it('should create TimeCounters instance by params', () => {
            const timeCounter = new TimeCounters(new RedisMock(), 'test', {});
            assert.strictEqual(timeCounter instanceof TimeCounters, true);
        });
    });

    describe('checkAndIncrement', () => {
        it('should return true if limit is not exceeded', async () => {
            const limits = {
                60: 2,
                3600: 3
            };
            const isIncrementFirst = false;
            const timeCounter = new TimeCounters(new RedisMock(), 'test', { limits, isIncrementFirst });
            const KEY = 'key';
            const res = await timeCounter.checkAndIncrement(KEY);
            assert.strictEqual(res, 0);
        });

        it('should return false if minute limit is exceeded', async () => {
            const redis = new RedisMock();
            const now = parseInt(Date.now() / 1000, 10)
            redis.hgetallAsyncFunc = () => ({ [now]: redis.hgetallAsyncCnt / 2 });
            const limits = {
                60: 3,
                3600: 30
            };
            const isIncrementFirst = false;
            const timeCounter = new TimeCounters(redis, 'test', { limits, isIncrementFirst, getNow: () => now });
            const KEY = 'key';
            let res = await timeCounter.checkAndIncrement(KEY);
            assert.strictEqual(res, 0);
            res = await timeCounter.checkAndIncrement(KEY);
            assert.strictEqual(res, 0);
            res = await timeCounter.checkAndIncrement(KEY);
            assert.strictEqual(res, 60);
        });


        it('should return false if limit is exceeded', async () => {
            const redis = new RedisMock();
            const now = parseInt(Date.now() / 1000, 10)
            redis.hgetallAsyncFunc = () => ({
                [now - 62]: 40
            });
            const limits = {
                60: 3,
                3600: 30
            };
            const isIncrementFirst = false;
            const timeCounter = new TimeCounters(redis, 'test', { limits, isIncrementFirst, getNow: () => now });
            const KEY = 'key';
            const res = await timeCounter.checkAndIncrement(KEY);
            assert.strictEqual(res, 3600 - 62);
        });
    });

    describe('_rollupKey', () => {
        it('should rollup by rules', async () => {
            const redis = new RedisMock();
            const now = parseInt(Date.now() / 1000, 10)
            redis.hgetallAsyncFunc = () => ({
                [now - 62]: 40,
                [now - 63]: 30
            });
            const limits = {
                60: 3,
                3600: 30
            };
            const isIncrementFirst = false;
            const timeCounter = new TimeCounters(redis, 'test', { limits, isIncrementFirst, getNow: () => now });
            const KEY = 'key';
            const res = await timeCounter._rollupKey(KEY);
            res.toDelete = res.toDelete.sort();
            assert.deepStrictEqual(res, {
                toDelete: [
                    String(now - 62),
                    String(now - 63)
                ].sort(),
                toSet: {
                    [(now - 62) - ((now - 62) % 60)]: 70
                }
            });
        });
    });
});
