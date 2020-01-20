
class ResourceUnavailableError extends Error {
    constructor(errorList, message = 'internal error') {
        super(message);
        this.errorList = errorList;
    }

    toJSON() {
        return {
            message: this.toString(),
            errorList: this.errorList
        };
    }
}

module.exports = ResourceUnavailableError;
