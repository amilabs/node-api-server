const { mapValues, get, pickBy } = require('lodash');
const ValidationError = require('./error');

let defaultValidators = {
    object: param => typeof param === 'object',
    string: param => typeof param === 'string',
    number: param => typeof param === 'number',
    int: param => Number.isInteger(param),
    array: param => Array.isArray(param)
};

function addDefaultValidators(validators) {
    defaultValidators = { ...defaultValidators, ...validators };
}

function getDefaultFieldValidatorByName(name) {
    const validator = defaultValidators[name];
    if (validator) {
        validator.name = name;
    }
    return validator;
}

class Validator {
    constructor(fieldRules, globalRules = []) {
        this.fieldRules = mapValues(fieldRules, (val) => {
            if (!Array.isArray(val)) {
                val = [val];
            }
            return val.map((validator) => {
                if (typeof validator === 'string') {
                    validator = getDefaultFieldValidatorByName(validator);
                }
                if (typeof validator !== 'function') {
                    throw new Error('Unknown validator');
                }
                return validator;
            });
        });

        if (!Array.isArray(globalRules)) {
            globalRules = [globalRules];
        }
        globalRules.forEach((rule) => {
            if (typeof rule !== 'function') {
                throw new Error('GlobalRule is not a function');
            }
        });
        this.globalRules = globalRules;
    }

    validate(data) {
        const errors = pickBy(
            mapValues(
                this.fieldRules,
                (fieldValidators, key) => {
                    const dataField = get(data, key);
                    const fieldErrors = fieldValidators.map((fieldValidator) => {
                        if (!fieldValidator(dataField, key, data)) {
                            return fieldValidator.name;
                        }
                        return false;
                    }).filter(val => Boolean(val));
                    return Object.keys(fieldErrors).length ? fieldErrors : false;
                }
            ),
            val => Boolean(val)
        );

        if (Object.keys(errors).length) {
            throw new ValidationError(errors);
        }
        return true;
    }
}

module.exports = { Validator, addDefaultValidators };
