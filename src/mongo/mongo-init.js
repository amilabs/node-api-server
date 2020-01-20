const { MongoClient } = require('mongodb');

const mongoLogEvents = {
    close: 'warn',
    error: 'warn',
    fullsetup: 'warn',
    parseError: 'warn',
    reconnect: 'warn',
    timeout: 'warn'
};

function mongoInit(config, logger = undefined, indexesList = {}, collectionList = {}) {
    let mongoDb;
    let mongoClient;
    return new Promise((resolve, reject) => {
        MongoClient.connect(config.mongodb.uri, async (err, client) => {
            logger.debug('[Init mongodb] connected');
            if (err) {
                return reject(err);
            }
            mongoClient = client;
            mongoDb = client.db(config.mongodb.dbName);
            try {
                if (logger) {
                    logger.debug('[Init mongodb] wrap by logger');
                    logger.logEvent(mongoDb, mongoLogEvents);
                }
                if (config.mongodb.initCollections) {
                    logger.debug('[Init mongodb] Init collections');
                    await Promise.all(Object.keys(collectionList)
                        .map(async collectionName =>
                            (mongoDb.createCollection(collectionName, collectionList[collectionName]))));
                }
                if (config.mongodb.initIndexes) {
                    logger.debug('Init indexes');
                    await Promise.all(Object.keys(indexesList).map(async (collectionName) => {
                        const collection = mongoDb.collection(collectionName);
                        return Promise.all(indexesList[collectionName]
                            .map(async index => collection.createIndex(index.fields, index.options)));
                    }));
                }
            } catch (e) {
                reject(e);
            }
            return resolve({
                mongoDb,
                mongoClient
            });
        });
    });
}

module.exports = { mongoInit };
