const _ = require('lodash');

const PARALLEL_KEYS_ROLLUP = 10;

class TimeCounters {
    constructor(redis, prefix, options = {}) {
        this.redisInstance = redis;
        this.prefix = prefix;
        this.isIncrementFirst = options.isIncrementFirst !== false;
        this.rollupPeriods = options.isIncrementFirst || {
            ignore: 60,
            rollup: [
                {
                    period: 60,
                    lt: 60 * 60
                },
                {
                    period: 60 * 60,
                    lt: 24 * 60 * 60
                }
            ]
        };
        this.expireKeyTime = options.expireKeyTime || Math.max(...this.rollupPeriods.rollup.map(({ lt }) => lt));
        this.getNow = options.getNow || (() => parseInt(Date.now() / 1000, 10));
        this.limits = options.limits || {
            60: 100,
            3600: 1000
        };
        this.parallelKeyRollupChunkSize = options.parallelKeyRollupChunkSize || PARALLEL_KEYS_ROLLUP;
        this.options = options;
    }


    getCounterKey(key) {
        return `${this.prefix}:counters:${key}`;
    }

    async checkAndIncrement(key) {
        const now = this.getNow();
        let overflowConst = 1;
        if (this.isIncrementFirst) {
            overflowConst = 0;
            await this.redisInstance.hincrbyAsync(this.getCounterKey(key), now, 1);
        }
        const counters = await this.redisInstance.hgetallAsync(this.getCounterKey(key));
        const limits = _.clone(this.limits);
        for (const time in counters) {
            for (const limit in limits) {
                if (now - time < limit) {
                    limits[limit] = limits[limit] - counters[time];
                }
                if (limits[limit] < overflowConst) {
                    if (this.isIncrementFirst) {
                        await this.redisInstance.hincrbyAsync(this.getCounterKey(key), now, -1);
                    }
                    return false;
                }
            }
        }
        if (!this.isIncrementFirst) {
            await this.redisInstance.hincrbyAsync(this.getCounterKey(key), now, 1);
        }
        return true;
    }

    async rollup(keys = []) {
        const keysChunks = _.chunk(keys, this.parallelKeyRollupChunkSize);
        for (const chunk of keysChunks) {
            await Promise.all(chunk.map(key => this._rollupKey(key)));
        }
    }

    async _rollupKey(key) {
        const now = this.getNow();
        const redisCountKey = this.getCounterKey(key);
        const counters = await this.redisInstance.hgetallAsync(redisCountKey);
        const groupedCounter = _(counters)
            .toPairs()
            .groupBy(([time]) => {
                if (now - time < this.rollupPeriods.ignore) {
                    return 'ignore';
                }
                for (const { lt, period } of this.rollupPeriods.rollup) {
                    if (now - time < lt) {
                        return parseInt(time / period, 10) * period;
                    }
                }
                return 'delete';
            })
            .value();
        delete groupedCounter.ignore;
        let toDelete = _(groupedCounter)
            .mapValues(v => v.map(([val]) => val))
            .values()
            .flatten()
            .value();

        delete groupedCounter.delete;
        const toSet = _(groupedCounter)
            .mapValues(v => v.map(([, elem]) => elem).reduce((sum, val) => sum + parseInt(val, 10), 0))
            .value();

        toDelete = toDelete.filter(v => toSet[v] !== Number(counters[v]));

        const redisMulti = this.redisInstance.multi();
        if (toDelete.length) {
            toDelete.forEach(toDel => redisMulti.hdel(redisCountKey, toDel));
        }
        if (Object.keys(toSet).length) {
            redisMulti.hmset(redisCountKey, ..._(toSet).toPairs().flatten().values());
        }
        if (Object.keys(toSet).length || toDelete.length) {
            return new Promise((resolve, reject) => {
                redisMulti.exec((err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve({
                        toSet,
                        toDelete,
                    });
                });
            });
        }
        return Promise.resolve({});
    }
}

module.exports = { TimeCounters };
