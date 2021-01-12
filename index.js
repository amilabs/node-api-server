const server = require('./src/server');
const validators = require('./src/validators');
const mongo = require('./src/mongo');
const redis = require('./src/redis');
const utils = require('./src/utils');
const { HttpClient } = require('./src/http-client');
const metric = require('@timophey01/metric');
const cli = require('./src/cli');
const { initLogger } = require('@timophey01/logger');


module.exports = {
    ...server,
    HttpClient,
    initMetric: metric.initMetric,
    metric,
    initLogger,
    validators,
    cli,
    mongo,
    redis,
    utils
};
