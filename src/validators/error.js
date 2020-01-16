
class ValidationError extends Error {
    constructor(errorList) {
        const errText = Object.keys(errorList)
            .map(field => `${field} validators:[${errorList[field].join(', ')}]`)
            .join(', ');
        super(`Invalid fields ${errText}`);
        this.errorList = errorList;
    }

    toJSON() {
        return {
            message: this.toString(),
            errorList: this.errorList
        };
    }
}

module.exports = ValidationError;
