const { MongoCollection } = require('./mongo-collection');

class Timeline extends MongoCollection {
    constructor(
        collection,
        schema,
        {
            uniqueKeys = [],
            updateTimeField = 'updatedTime',
            deletedField = 'isDeleted',
            createTimeField = 'createdTime'
        }
    ) {
        super(collection, schema, uniqueKeys);
        if (!schema.properties[updateTimeField]) {
            throw new Error(`Schema should consists time field ${updateTimeField}`);
        }
        this.deletedField = deletedField;
        this.updateTimeField = updateTimeField;
        this.createTimeField = createTimeField;
        this.limitOnDiff = 1000;
    }

    async insertMany(data) {
        return super.insertMany(data.map(d => ({
            ...d,
            [this.createTimeField]: Date.now(),
            [this.updateTimeField]: Date.now(),
            [this.deletedField]: false
        })));
    }

    async insertOne(row) {
        return super.insertOne({
            ...row,
            [this.updateTimeField]: Date.now(),
            [this.createTimeField]: Date.now(),
            [this.deletedField]: false
        });
    }

    async updateOne(selector, data) {
        return super.updateOne(
            { ...selector },
            { ...data, [this.updateTimeField]: Date.now() }
        );
    }

    async markAsDeleted(selector) {
        return super.update(selector, {
            $set: {
                [this.deletedField]: true,
                [this.updateTimeField]: Date.now()
            }
        });
    }

    async getMaxUpdateTime(selector) {
        return this.find(selector, 1, { [this.updateTimeField]: -1 })
            .then(([row]) => (row ? row[this.updateTimeField] : 0));
    }

    async getDiff(selector, fromTime) {
        return Promise.all([
            this.find(
                {
                    ...selector,
                    [this.createTimeField]: { $gt: fromTime },
                    [this.deletedField]: false
                },
                this.limitOnDiff,
                {
                    [this.updateTimeField]: -1
                }
            ),
            this.find(
                {
                    ...selector,
                    [this.updateTimeField]: { $gt: fromTime },
                    [this.createTimeField]: { $lte: fromTime },
                    [this.deletedField]: false
                },
                this.limitOnDiff,
                {
                    [this.updateTimeField]: -1
                }
            ),
            this.find(
                {
                    ...selector,
                    [this.updateTimeField]: { $gt: fromTime },
                    [this.deletedField]: true
                },
                this.limitOnDiff,
                {
                    [this.updateTimeField]: -1
                }
            )
        ]).then(([created, updated, deleted]) => ({ created, updated, deleted }));
    }
}

module.exports = { Timeline };
