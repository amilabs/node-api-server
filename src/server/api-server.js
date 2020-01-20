const express = require('express');
const createMiddleware = require('swagger-express-middleware');
const _ = require('lodash');
const uuid4 = require('uuid/v4');
const cors = require('cors');
const { writeTime, writeSingleMetric } = require('metric');
const { Validator } = require('../validators/validator');
const { getMetricPathREST, camelCaseToKebab } = require('../utils');
const ValidationError = require('../validators/error');
const ResourceUnavailableError = require('./resource-error');
const MongoValidationError = require('../mongo/errors/validation');
const { mongoInit } = require('../mongo/mongo-init');
const { initMetric } = require('metric');

const httpServerLogEvent = {
    close: 'info',
};

const MONGO_RECONNECT_INTERVAL = 1000;

class ApiServer {
    constructor(config, logger, metric) {
        initMetric(config.metric || {});
        this.logger = logger;
        this.app = null;
        this.metric = metric;
        this.config = config;
        this.swaggerMiddlewares = null;
        this.resources = {};
        this.name = camelCaseToKebab(this.constructor.name) || 'unnamed-api-server';
    }

    getLogger(res) {
        if (res && res.locals.resources && res.locals.resources.logger) {
            return res.locals.resources.logger;
        }
        return this.logger;
    }

    corsMiddleware(corsOptions) {
        return cors(corsOptions);
    }

    async getResources(res, resourceList) {
        const resources = {
            ..._.pick(this.resources, resourceList),
            ..._.pick(res.locals.resources || {}, resourceList)
        };
        if (Object.keys(resources).length !== resourceList.length) {
            throw Error(`Resources: [${_.difference(resourceList, Object.keys(resources)).join(',')}] not found`);
        }
        return resources;
    }

    async initMongoResources(isReconnect = false, indexesList = {}, collectionList = {}) {
        return mongoInit(
            this.config,
            this.logger,
            indexesList,
            collectionList
        ).then(({ mongoDb, mongoClient }) => {
            mongoClient.on('close', () => setTimeout(() => {
                writeSingleMetric(`mongo.${process.pid}.close`, 1);
                this.initMongoResources(true).catch(e => this.logger.sendError(e));
            }, MONGO_RECONNECT_INTERVAL));
            this.resources = {
                ...this.resources,
                mongoDb,
                mongoClient,
            };
            return { mongoDb, mongoClient };
        }).catch((e) => {
            this.logger.sendError(e);
            if (isReconnect) {
                setTimeout(() => {
                    this.initMongoResources(true);
                }, MONGO_RECONNECT_INTERVAL);
            }
        });
    }

    async initRoutes(routes) {
        this.logger.debug('initRestRoutes');
        return new Promise(async (resolve, reject) => {
            routes.map(({
                path, method, validator, resourceList, route, preprocessors = []
            }) => {
                try {
                    const routeValidator = new Validator(validator);
                    return this.app[method](path, async (req, res, next) => {
                        req.body = req.body || {};
                        res.locals.path = path;
                        try {
                            if (preprocessors.length) {
                                preprocessors.forEach(preprocessor => preprocessor(req, res, next));
                            }
                            const params = req.body;
                            routeValidator.validate(params);
                            const resources = await this.getResources(res, resourceList);
                            const response = await route(params, resources);
                            res.send(response);
                            return next();
                        } catch (e) {
                            return next(e);
                        }
                    });
                } catch (e) {
                    return reject(e);
                }
            });
            resolve(routes);
        });
    }

    createHttpServer() {
        const server = express();
        if (this.logger) {
            this.logger.logEvent(server, httpServerLogEvent);
        }
        this.app = server;
        return server;
    }

    async initSwaggerMiddlewares(pathToSwagger) {
        this.logger.debug('initSwaggerMiddlewares');
        return new Promise((resolve, reject) => {
            try {
                createMiddleware(pathToSwagger, this.app, (err, middleware) => {
                    if (err) {
                        return reject(err);
                    }
                    this.swaggerMiddlewares = middleware;
                    return resolve(this.swaggerMiddlewares);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    writeMetricMiddleware(getPath = getMetricPathREST('api')) {
        return (req, res, next) => {
            if (res.locals.__startTime) {
                writeTime(`${getPath(req, res)}.ok`, Date.now() - res.locals.__startTime);
            }
            next();
        };
    }

    writeErrorMetricMiddleware(getPath = getMetricPathREST('api')) {
        return (err, req, res, next) => {
            if (res.locals.__startTime) {
                writeTime(`${getPath(req, res)}.err`, Date.now() - res.locals.__startTime);
            }
            next(err);
        };
    }

    startTimeMiddleware() {
        return (req, res, next) => {
            res.locals.__startTime = Date.now();
            next();
        };
    }

    requestIdMiddleware() {
        return (req, res, next) => {
            if (req.headers['X-Request-Id']) {
                res.locals.requestId = req.headers['X-Request-Id'];
            } else {
                res.locals.requestId = uuid4();
            }
            next();
        };
    }

    healthCheck() {
        return {};
    }

    resourceCheckMiddleware() {
        return (req, res, next) => {
            const healthChecks = this.healthCheck();
            const errorList = _.pickBy(healthChecks, val => val !== true);
            if (Object.keys(errorList).length) {
                throw new ResourceUnavailableError(errorList);
            }
            next();
        };
    }

    healthCheckRoute() {
        return (req, res, next) => {
            const healthChecks = this.healthCheck();
            const errorList = _.pickBy(healthChecks, val => val !== true);
            if (Object.keys(errorList).length) {
                res.status(500).send(healthChecks);
            } else {
                res.status(200).send(healthChecks);
            }
            next();
        };
    }

    sendError(res, status = 500, message = 'internal error', info = {}) {
        res.status(status).send({
            message,
            info
        });
    }

    errorHandlingMiddleware() {
        return (err, req, res, next) => {
            if (err) {
                this.getLogger(res).sendError(err);
                if (err.status) {
                    this.sendError(res, err.status, err.message || '', {});
                    return next(err);
                }
                if (err instanceof ValidationError) {
                    this.sendError(res, 400, err.toString(), {});
                    return next(err);
                }

                if (err instanceof ResourceUnavailableError) {
                    this.sendError(res, 500, 'resource unavailable', err.errorList);
                    return next(err);
                }
                if (err instanceof MongoValidationError) {
                    this.sendError(res, 500, 'Mongo validation', {
                        info: err.errorInfo,
                        data: err.data,
                        schema: err.schema
                    });
                    return next(err);
                }
                res.sendStatus(500);
                return next(err);
            }
            return next(err);
        };
    }

    errorLogMiddleware() {
        return (err, req, res, next) => {
            this.getLogger(res).sendError(err, (err.toJSON && err.toJSON()) || {});
            next(err);
        };
    }

    loggerWithContextMiddleware() {
        return (req, res, next) => {
            if (!res.locals.resources) {
                res.locals.resources = {};
            }
            const context = {};
            if (res.locals.requestId) {
                context.requestId = res.locals.requestId;
            }
            res.locals.resources.logger = this.logger.getLoggerWithContext(context);
            next();
        };
    }

    writeRequestLog() {
        return (req, res, next) => {
            this.getLogger(res).info(`Getting request ${req.method} ${req.path}`, {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                body: req.body
            });
            next();
        };
    }

    async initResources() {
        this.logger.debug('init resources');
        return Promise.resolve({});
    }

    async beforeStart() {
        this.createHttpServer(this.logger, this.config);
        return Promise.all([
            this.initSwaggerMiddlewares(this.config.swaggerPath),
            this.initResources()
        ]);
    }

    async afterFinish() {
        return new Promise((resolve) => {
            this.app.close(() => {
                resolve();
            });
        });
    }

    async start(port, host = '0.0.0.0') {
        this.logger.info('starting server...');
        const res = await this.beforeStart();
        this.logger.debug('in start', res);
        writeSingleMetric(`service.${process.pid}.start`, 1);
        return new Promise((resolve, reject) => {
            this.app.listen(port, host, (err, info) => {
                if (err) {
                    return reject(err);
                }
                return resolve(info);
            });
        });
    }

    async stop() {
        writeSingleMetric(`service.${process.pid}.stop`, 1);
        return this.afterFinish();
    }
}

module.exports = { ApiServer };
