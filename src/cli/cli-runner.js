const optimist = require('optimist');
const config = require('config');

class CliRunner {
    constructor(Job, options = {}) {
        const usage = Job.usage || options.usage || 'Usage: $0';
        const argsList = Job.argList || options.argList || [];
        let opt = optimist.usage(usage);
        argsList.forEach((arg) => {
            if (arg.required) {
                opt = opt.demand(arg.name);
            }
            if (arg.description) {
                opt = opt.describe(arg.name, arg.description);
            }
            if (arg.alias) {
                opt = opt.alias(arg.name, arg.alias);
            }
        });
        const args = opt.argv;
        this.job = new Job(args, config);
    }

    async run() {
        try {
            await this.job.run();
        } catch (e) {
            console.error(e); // eslint-disable-line
            process.exit(1);
        }
        process.exit(0);
    }

    // TODO SIGNALS handling
}

module.exports = { CliRunner };
