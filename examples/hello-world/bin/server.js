const config = require('config');

const { HelloWorld, initLogger, initMetric } = require('../src/helloworld');

const logger = initLogger(config.logger);
const metric = initMetric(config.metric || {});

const server = new HelloWorld(config, logger, metric, []);

(async () => {
    try {
        await server.start(config.app.port, config.app.host);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
