const assert = require('assert');
const { MongoCollection } = require('../../src/mongo/mongo-collection');


const schema = {
    type: 'object',
    properties: {
        fieldString: {
            type: 'string'
        },
        fieldNumber: {
            type: 'number'
        },
        fieldArray: {
            type: 'array'
        }
    }
};

class MongoCollectionDumb {
    constructor() {
        this.insertOneFunc = () => {};
        this.insertOneCnt = 0;
        this.updateOneFunc = () => {};
        this.updateOneCnt = 0;
        this.findOneFunc = () => {};
        this.findOneCnt = 0;
        this.insertManyFunc = () => {};
        this.insertManyCnt = 0;
    }

    insertOne(...args) {
        this.insertOneCnt++;
        return this.insertOneFunc(...args);
    }

    findOne(...args) {
        this.findOneCnt++;
        return this.findOneFunc(...args);
    }

    updateOne(...args) {
        this.updateOneCnt++;
        return this.updateOneFunc(...args);
    }

    insertMany(...args) {
        this.insertManyCnt++;
        return this.insertManyFunc(...args);
    }
}


describe('MongoCollection', () => {
    describe('constructor', () => {
        it('should throw error on invalid schema', () => {
            let error;
            try {
                new MongoCollection({}, { type: 123 });
            } catch (e) {
                error = e;
            }
            assert.equal(error instanceof Error, true);
        });

        it('should create validator with single validator on fields', () => {
            const mongo = new MongoCollection({}, schema)
            assert.equal(mongo instanceof MongoCollection, true);
        });

    });

    describe('upsert', () => {
        it('should call only insertOne if unique keys is empty', async () => {
            const collection = new MongoCollectionDumb();
            const mongoCollection = new MongoCollection(collection, schema);
            await mongoCollection.upsert({ fieldString: 'str', fieldNumber: 123 })
            assert.equal(collection.insertOneCnt, 1);
            assert.equal(collection.insertManyCnt, 0);
            assert.equal(collection.updateOneCnt, 0);
            assert.equal(collection.findOneCnt, 0);
        });

        it('should call findOne with unique keys and updateOne if set unique keys and found row', async () => {
            const collection = new MongoCollectionDumb();
            collection.findOneFunc = (selector) => {
                assert.deepEqual({
                    fieldNumber: 123
                }, selector);
                return { fieldNumber: 123, fieldString: "str1" };
            };
            const mongoCollection = new MongoCollection(collection, schema, { uniqueKeys: ['fieldNumber'] });
            await mongoCollection.upsert({fieldString: "str", fieldNumber: 123});
            assert.equal(collection.findOneCnt, 1);
            assert.equal(collection.updateOneCnt, 1);
            assert.equal(collection.insertManyCnt, 0);
            assert.equal(collection.insertOneCnt, 0);
        });

        it('should call findOne with unique and insertOne if set unique and not found row', async () => {
            const collection = new MongoCollectionDumb();
            collection.findOneFunc = (selector) => {
                assert.deepEqual({
                    fieldNumber: 123
                }, selector);
                return null;
            };
            const mongoCollection = new MongoCollection(collection, schema, { uniqueKeys: ['fieldNumber'] });
            await mongoCollection.upsert({fieldString: "str", fieldNumber: 123});
            assert.equal(collection.findOneCnt, 1);
            assert.equal(collection.insertOneCnt, 1);
            assert.equal(collection.updateOneCnt, 0);
            assert.equal(collection.insertManyCnt, 0);
        });
    });


    describe('insertOne', function() {
        it('should call only insertOne if data valid', async () => {
            const collection = new MongoCollectionDumb();
            const mongoCollection = new MongoCollection(collection, schema);
            collection.insertOneFunc = (data) => {
                assert.deepEqual(data, {fieldString: "str", fieldNumber: 123});
            };
            await mongoCollection.insertOne({fieldString: "str", fieldNumber: 123})
            assert.equal(collection.insertOneCnt, 1);
            assert.equal(collection.insertManyCnt, 0);
            assert.equal(collection.updateOneCnt, 0);
            assert.equal(collection.findOneCnt, 0);
        });

        it('should throw error if data invalid by schema', async () => {
            const collection = new MongoCollectionDumb();
            let error = null;
            const mongoCollection = new MongoCollection(collection, schema, { uniqueKeys: ['fieldNumber'] });
            try {
                await mongoCollection.insertOne({fieldString: 12345, fieldNumber: 123});
            } catch (e) {
                error = e;
            }
            assert.equal(error instanceof Error, true);
            assert.equal(collection.findOneCnt, 0);
            assert.equal(collection.updateOneCnt, 0);
            assert.equal(collection.insertManyCnt, 0);
            assert.equal(collection.insertOneCnt, 0);
        });
    });


    describe('updateOne', function() {
        it('should call only updateOne if data valid', async () => {
            const collection = new MongoCollectionDumb();
            const mongoCollection = new MongoCollection(collection, schema);
            collection.updateOneFunc = (selector, data) => {
                assert.deepEqual(data, {$set: { fieldString: "str" } });
                assert.deepEqual(selector, { fieldNumber: 123 });
            };
            await mongoCollection.updateOne({ fieldNumber: 123 }, { fieldString: "str" })
            assert.equal(collection.insertOneCnt, 0);
            assert.equal(collection.insertManyCnt, 0);
            assert.equal(collection.updateOneCnt, 1);
            assert.equal(collection.findOneCnt, 0);
        });

        it('should throw error if data invalid by schema', async () => {
            const collection = new MongoCollectionDumb();
            let error = null;
            const mongoCollection = new MongoCollection(collection, schema, { uniqueKeys: ['fieldNumber'] });
            try {
                await mongoCollection.updateOne({ fieldNumber: 123 }, { fieldString: 12345 });
            } catch (e) {
                error = e;
            }
            assert.equal(error instanceof Error, true);
            assert.equal(collection.findOneCnt, 0);
            assert.equal(collection.updateOneCnt, 0);
            assert.equal(collection.insertManyCnt, 0);
            assert.equal(collection.insertOneCnt, 0);
        });
    });
});
