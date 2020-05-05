const got = require('got');

const HttpAgent = require('agentkeepalive');

const { HttpsAgent } = HttpAgent;

class HttpClient {
    constructor(host, { agentOptions, requestOptions = {} }) {
        this.host = host;
        this.requestOptions = {
            ...requestOptions,
            agent: {
                http: new HttpAgent(agentOptions),
                https: new HttpsAgent(agentOptions)
            }
        };
    }

    get(path, options = {}) {
        return got(`${this.host}${path}`, {
            ...this.requestOptions,
            ...options
        });
    }

    post(path, options = {}) {
        return got.post(`${this.host}${path}`, {
            ...this.requestOptions,
            ...options
        });
    }
}


module.exports = { HttpClient }
