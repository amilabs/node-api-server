const { Queue } = require('../queue');

class DelayPeriod {
    constructor(delay) {
        this.delay = delay;
    }
}

class FailForce {}

class TimeLimitsQueue extends Queue {
    constructor(name, redis, options = {}, limits) {
        options.queueOptions = {
            ...(options.queueOptions || {}),
            settings: {
                backoffStrategies: {
                    delayable: (attemptsMade, err) => this.backoffDelayableStrategy(attemptsMade, err)
                }
            }
        };
        super(name, redis, options);
        this.realAttemptCount = options.attemptCount || 1;
        this.globalLimit = limits.global;
        this.perJobLimits = limits.perJob;
    }

    async add(job, opt) {
        const delay = await this.globalLimit.checkAndIncrement('global');
        if (delay) {
            return this.delayQueue(delay * 1000);
        }

        return super.add(job, {
            ...opt,
            attempts: 900001,
            backoff: {
                type: 'delayable'
            }
        });
    }

    /**
     * @param job
     */
    processCallbackWrapper(callback) {
        return async (job) => {
            const delays = await Promise.all(this.perJobLimits.map(async (
                { timeCounter, getIdFunc, dropCondition }) => {
                const id = getIdFunc(job);
                return {
                    delay: await timeCounter.checkAndIncrement(id),
                    id,
                    timeCounter,
                    dropCondition
                };
            }));
            const isDrop = Boolean(delays.filter(({ delay, dropCondition }) => delay > dropCondition).length);
            if (isDrop) {
                delays
                    .filter(({ delay }) => delay === 0)
                    .forEach(({ timeCounter, id }) => timeCounter.decrementLast(id));
                return Promise.reject(new FailForce());
            }
            const maxDelay = Math.max(...delays.map(({ delay }) => delay));
            if (maxDelay) {
                delays
                    .filter(({ delay }) => delay === 0)
                    .forEach(({ timeCounter, id }) => timeCounter.decrementLast(id));
                return Promise.reject(new DelayPeriod(maxDelay * 1000));
            }
            return callback(job);
        };
    }

    setProcessCallback(callback) {
        super.setProcessCallback(this.processCallbackWrapper(callback));
    }

    process(...args) {
        return super.process(...args);
    }

    backoffDelayableStrategy(attemptsMade, err) {
        if (err instanceof DelayPeriod) {
            return err.delay;
        }
        if (attemptsMade >= this.realAttempt || err instanceof FailForce) {
            return -1;
        }
        return 0;
    }
}

module.exports = { TimeLimitsQueue };
