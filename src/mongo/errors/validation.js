
class ValidationError extends Error {
    constructor(errorInfo, data, schema) {
        super('Validation error');
        this.errorInfo = errorInfo;
        this.data = data;
        this.schema = schema;
    }

    toJSON() {
        return {
            message: this.toString(),
            errorInfo: this.errorInfo,
            errorData: this.data,
            errorSchema: this.schema,
        };
    }
}

module.exports = ValidationError;
