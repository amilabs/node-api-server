const server = require('./src/server');
const validators = require('./src/validators');
const mongo = require('./src/mongo');
const redis = require('./src/redis');
const utils = require('./src/utils');
const { HttpClient } = require('./src/http-client');
const metric = require('metric');
const cli = require('./src/cli');
const { initLogger } = require('logger');


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
