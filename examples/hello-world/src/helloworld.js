const {
    ApiServer,
    utils: {
        getMetricPathREST
    }
} = require('api-server');

const routes = [{
    path: '/hello-world',
    method: 'get',
    resourceList: [],
    preprocessors: [],
    validator: {},
    route: async () => 'Hello world'
}];

class HelloWorld extends ApiServer {
    constructor(...args) {
        super(...args);
        this.routes = routes;
    }

    async beforeStart() {
        try {
            await super.beforeStart();
            this.app.use(this.corsMiddleware());
            this.app.use(this.startTimeMiddleware());
            this.app.use(this.swaggerMiddlewares.metadata());
            this.app.use(this.swaggerMiddlewares.parseRequest());
            this.app.use(this.requestIdMiddleware());
            this.app.use(this.loggerWithContextMiddleware());
            this.app.use(this.writeRequestLog());
            this.app.use(this.swaggerMiddlewares.validateRequest());
            this.app.use(this.resourceCheckMiddleware());
            this.app.get('/health-check', this.healthCheckRoute());
            await this.initRoutes(this.routes);
            this.app.use(this.errorHandlingMiddleware());
            this.app.use(this.writeMetricMiddleware());
            this.app.use(this.writeErrorMetricMiddleware((req, res) => {
                const restGetPath = getMetricPathREST('api');
                if (!res.locals.path && req.url.indexOf('/sync/') === 0) {
                    return `api.${req.method.toLowerCase()}._sync_userid_timestamp`;
                }
                return `${restGetPath(req, res)}`;
            }));
        } catch (e) {
            throw e;
        }
        return Promise.resolve();
    }
}

module.exports = { HelloWorld };
