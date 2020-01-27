let api;
try {
    api = require('../../../index'); // eslint-disable-line
} catch (e) {
    api = require('api-server'); // eslint-disable-line
}


const {
    cli: { CronJob },
    metric: { objectWrapMetric },
    initMetric,
    initLogger,
    mongo: { mongoInit },
    utils: { metricMethodList, logMethodList }
} = api;

const { Test } = require('./mongo/test');

class Daemon extends CronJob {
    async job() {
        initMetric(this.options.metric);
        const logger = initLogger(this.options.metric);
        const { mongoDb, mongoClient } = await mongoInit(this.options);
        const test = logger.wrapObject(
            objectWrapMetric(
                new Test(mongoDb.collection('test')),
                metricMethodList,
                'mongodb.test_collection'
            ),
            logMethodList,
            'TestCollection'
        );
        test.upsertMany([
            { key1: 'sdfa', key2: 123, key3: 'std' },
            {
                key1: 'sdfa1',
                key2: 1233,
                key3: 'std23',
                key4: { aaa: 'ccc' }
            },
            {
                key1: 'sdfa1',
                key2: 123323,
                key3: 'std2323',
                key4: { aaa: 'c1231231' }
            }
        ]);
        await mongoClient.close();
    }

    static get ArgList() {
        return [{
            name: 't',
            alias: 'test-arg',
            description: 'test argument',
            required: true
        }];
    }
}

module.exports = { Daemon }
