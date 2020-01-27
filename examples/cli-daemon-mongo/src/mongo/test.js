let api;
try {
    api = require('../../../../index'); // eslint-disable-line
} catch (e) {
    api = require('api-server'); // eslint-disable-line
}

const { MongoCollection } = api.mongo;
const schema = require('../../schema/json/test-collection');

class Test extends MongoCollection {
    constructor(collection) {
        super(collection, schema, { uniqueKeys: ['key2', 'key3'] });
    }
}

module.exports = { Test };
