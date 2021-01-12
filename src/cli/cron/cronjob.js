const lockFile = require('lockfile');
const os = require('os');
const { initLogger } = require('@timophey01/logger');
const { initMetric, getStartedTimer } = require('@timophey01/metric');

const DEFAULT_LOCK_RETRY_COUNT = 3;

class CronJob {
    constructor(args, options) {
        const filename = __filename.split('/');
        this.name = options.name || filename[filename.length - 1].replace(/./, '_');
        this.options = options;
        this.args = args;
        this.hostname = options.hostname || os.hostname().split('.')[0];
    }

    async initBase() {
        this.logger = initLogger(this.options.logger || {
            level: 'debug',
            transports: [{ type: 'Console' }]
        });
        this.metric = initMetric({
            metricPrefix: `${this.hostname}.crons.${this.name}`,
            ...(this.options.metric || {})
        });
        return Promise.resolve();
    }

    async lock() {
        if (!this.options.lock) {
            return Promise.resolve();
        }
        this.options.lock = {
            dir: `${this.options.lock.dirname || '.'}/.locks`,
            filename: `${this.name}.lock`,
            ...this.options.lock,
            opt: {
                retries: DEFAULT_LOCK_RETRY_COUNT,
                ...(this.options.lock.opt || {})
            }
        };

        return new Promise((resolve, reject) => {
            lockFile.lock(
                `${this.options.lock.dir}/${this.options.lock.filename}`,
                this.options.lock.opt,
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                }
            );
        });
    }

    async unlock() {
        if (!this.options.lock) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            lockFile.unlock(`${this.options.lock.dir}/${this.options.lock.filename}`, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    async init() {
        return Promise.resolve();
    }

    async terminate() {
        return Promise.resolve();
    }

    async job() {
        throw new Error('Deny for base CronJob class');
    }

    async run() {
        await this.initBase();
        const timer = getStartedTimer('run');
        try {
            await this.lock();
        } catch (e) {
            this.logger.warn(e.toString());
            timer.send('lock');
            throw e;
        }
        try {
            await this.init();
            await this.job();
            timer.send('ok');
        } catch (e) {
            this.logger.sendError(e);
            timer.send('err');
        }
        await this.unlock();
        await this.terminate();
    }
}

module.exports = { CronJob };
