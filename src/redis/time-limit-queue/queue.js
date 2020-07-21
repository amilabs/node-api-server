const { Queue } = require('../queue');
const { fromPairs } = require('lodash');

class DelayPeriod {
    constructor(delay) {
        this.delay = delay;
    }
}

const loggerStub = {
    debug: console.log, info: console.log, error: console.log, warn: console.log
};

const GLOBAL_COUNTERS_KEY = 'global';

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
        /**
         * @var TimeCounters
         */
        this.globalLimit = limits.global;
        /**
         * @var TimeCounters[]
         */
        this.perJobLimits = limits.perJob;
    }

    async add(job, opt) {
        const delay = await this.globalLimit.checkAndIncrement(GLOBAL_COUNTERS_KEY);
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

    async getAllCounters(job) {
        return Promise.all([
            this.globalLimit.getCounters(GLOBAL_COUNTERS_KEY),
            ...this.perJobLimits.map(async ({
                timeCounter, getIdFunc, dropCondition, name
            }) => {
                const id = getIdFunc(job);
                return {
                    name,
                    counters: await timeCounter.getCounters(id),
                    id,
                    timeCounter,
                    dropCondition
                };
            })
        ]).then(([global, ...perJobs]) => ({
            global,
            ...fromPairs(perJobs.map(counter => [counter.name, counter]))
        }));
    }

    /**
     * @param job
     */
    processCallbackWrapper(callback, logger = loggerStub) {
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
            logger.debug('delays for job', { delays, jobData: job.data });
            const isDrop = Boolean(delays.filter(({ delay, dropCondition }) => delay > dropCondition).length);
            if (isDrop) {
                delays
                    .filter(({ delay }) => delay === 0)
                    .forEach(({ timeCounter, id }) => timeCounter.decrementLast(id));
                logger.debug('job is drop', { delays, jobData: job.data });
                return Promise.reject(new FailForce());
            }
            const maxDelay = Math.max(...delays.map(({ delay }) => delay));
            if (maxDelay) {
                delays
                    .filter(({ delay }) => delay === 0)
                    .forEach(({ timeCounter, id }) => timeCounter.decrementLast(id));
                logger.debug(`job is delayed to ${maxDelay}`, { delays, jobData: job.data });
                return Promise.reject(new DelayPeriod(maxDelay * 1000));
            }
            job.data.counters = await this.getAllCounters(job);
            return callback(job);
        };
    }

    setProcessCallback(callback, logger = loggerStub) {
        return super.setProcessCallback(this.processCallbackWrapper(callback, logger));
    }

    process(...args) {
        return super.process(...args);
    }

    backoffDelayableStrategy(attemptsMade, err) {
        if (err instanceof DelayPeriod) {
            return err.delay;
        }
        if (attemptsMade >= this.realAttemptCount || err instanceof FailForce) {
            return -1;
        }
        return 0;
    }
}

module.exports = { TimeLimitsQueue };
