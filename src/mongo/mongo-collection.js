const Ajv = require('ajv');
const _ = require('lodash');
const ValidationError = require('./errors/validation');


class MongoCollection {
    constructor(collection, schema, { uniqueKeys = [] } = {}) {
        this.pkField = '_id';
        this.collection = collection;
        this.schema = schema;
        if (schema.type !== 'object' || typeof schema.properties !== 'object') {
            throw Error('Schema should be valid schema of object');
        }
        this.validator = (new Ajv()).compile(schema);
        this.keys = Object.keys(schema.properties);
        this.uniqueKeys = uniqueKeys;
    }

    validateData(data) {
        if (!this.validator(data)) {
            throw new ValidationError(this.validator.errors);
        }
    }

    async upsertMany(records, findKeys = this.uniqueKeys) {
        const bulk = this.collection.initializeUnorderedBulkOp({ useLegacyOps: true });
        records.forEach(record => bulk.find(_.pick(record, findKeys)).upsert().updateOne(record));
        return bulk.execute();
    }

    async upsert(data) {
        if (this.uniqueKeys.length) {
            const selector = _.pick(data, this.uniqueKeys);
            const found = await this.findOne(selector);
            if (found) {
                const updatedFields = _.pick(data, _.difference(this.keys, this.uniqueKeys));
                return this.updateOne(selector, updatedFields);
            }
        }
        return this.insertOne(data);
    }

    async updateOne(selector, data) {
        this.validateData(data);
        return this.collection.updateOne(selector, { $set: data });
    }

    async update(selector, updateOperator) {
        return this.collection.update(selector, updateOperator);
    }

    async insertOne(data) {
        this.validateData(data);
        return this.collection.insertOne(data);
    }

    async findOne(selector) {
        return this.collection.findOne(selector);
    }

    async insertMany(data) {
        data.forEach(doc => this.validateData(doc));
        return this.collection.insertMany(data);
    }

    async aggregate(pipline) {
        return this.collection.aggregate(pipline).toArray();
    }

    async find(selector, limit = 100, order = undefined) {
        let cursor = this.collection.find(selector);
        if (order) {
            cursor = cursor.sort(order);
        }
        if (limit) {
            cursor = cursor.limit(limit);
        }
        return cursor.toArray();
    }

    async count(selector) {
        return this.collection.find(selector).count();
    }
}

module.exports = { MongoCollection };
