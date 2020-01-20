
class HttpError extends Error {
    constructor(status, details, message = 'Conflict') {
        super(message);
        this.status = status;
        this.details = details;
    }

    toJSON() {
        return {
            message: this.toString(),
            details: this.details
        };
    }
}

module.exports = HttpError;
