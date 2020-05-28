const { argv } = require('optimist');
const config = require('config');

class CliRunner {
    constructor(CronJob, configKey) {
        const args = argv;
        const options = configKey ? config[configKey] : config;
        this.cronJob = new CronJob(args, options);
    }

    async run() {
        try {
            await this.cronJob.run();
        } catch (e) {
            console.error(e); // eslint-disable-line no-console
            process.exit(1);
        }
        process.exit(0);
    }

    // TODO SIGNALS handling
}

module.exports = { CliRunner };
