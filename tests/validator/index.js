const assert = require('assert');
const { Validator, addDefaultValidators } = require('../../src/validators/validator');
const ValidationError = require('../../src/validators/error')

describe('Validator', function() {

    describe('constructor', function() {
        it('should throw error on unknown validator', () => {
            let error;
            try {
                new Validator({
                    field: "unknownValidator"
                })
            } catch (e) {
                error = e;
            }
            assert.equal(error instanceof Error, true);
        });


        it('should create validator with single validator on fields', () => {
            let error = null;
            try {
                new Validator({
                    field: "object"
                })
            } catch (e) {
                error = e;
            }
            assert.equal(error, null);
        });

        it('should create validator with array of validator on field', () => {
            let error = null;
            try {
                new Validator({
                    field: ['number', 'int']
                })
            } catch (e) {
                error = e;
            }
            assert.equal(error, null);
        });

        it('should create validator with mix validators', () => {
            let error = null;
            try {
                new Validator({
                    field: ['number', 'int'],
                    field2: 'object'
                })
            } catch (e) {
                error = e;
            }
            assert.equal(error, null);
        });
    });

    describe('validate function', function() {
        it('should return true on valid data', () => {
            const validator = new Validator({
                    field: ['number', 'int'],
                    field2: 'object'
                });
            assert.equal(validator.validate({
                field: 123,
                field2: {}
            }), true);
        });

        it('should throw error on invalid data', () => {
            let error;
            const validator = new Validator({
                test: ['number', 'int'],
                field2: 'object'
            });
            try {
                validator.validate({
                    test: '123.5',
                    field2: 'sdfas'
                })
            } catch (e) {
                error = e;
            }
            assert.equal(error instanceof ValidationError, true);
        });
    });

});
