const { TimeCounters } = require('./timecounters');
const { Queue } = require('./queue');
const { TimeLimitsQueue } = require('./time-limit-queue/queue');


const { mapValues } = require('lodash');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function initRedis({ host, port }) {
    return redis.createClient(port, host);
}

function initMultiRedis(redisList) {
    return mapValues(redisList, params => initRedis(params));
}

module.exports = {
    initRedis,
    initMultiRedis,
    TimeLimitsQueue,
    TimeCounters,
    Queue
};
