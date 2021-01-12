const BullQueue = require('bull');

class Queue {
    constructor(name, redis, options) {
        this.redis = redis;
        this.name = name;
        this.concurency = options.concurency || 1;
        this.queueOptions = {
            ...(options.queueOptions || {}),
            redis
        };
        this.processCallback = options.processCallback ? options.processCallback.bind(this) : null;
        this.instance = new BullQueue(this.name, this.queueOptions);
    }

    start() {
        this.instance.process('__default__', this.concurency, job => this.process(job));
    }

    async getJobCounts() {
        return this.instance.getJobCounts();
    }

    async stop() {
        return this.instance.close();
    }

    async delayQueue(time) {
        await this.instance.pause(false, true);
        return new Promise(resolve => setTimeout(() => resolve(this.instance.resume()), time));
    }

    async add(...args) {
        return this.instance.add(...args);
    }

    setProcessCallback(callback) {
        this.processCallback = callback.bind(this);
    }

    process(...args) {
        if (this.processCallback) {
            return this.processCallback(...args);
        }
        throw Error('Job processing not implemented');
    }
}

module.exports = { Queue };
