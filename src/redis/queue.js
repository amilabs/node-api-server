const BullQueue = require('bull');

class Queue {
    constructor(options) {
        this.redis = options.redis;
        this.name = options.name;
        this.queueOptions = options.queueOptions || {};
        this.instance = new BullQueue(this.name, this.redis, this.queueOptions);
    }

    add(data) {
        return this.instance.add(data);
    }

    process(callcack) {
        return this.instance.process(callcack);
    }
}

module.exports = { Queue };
