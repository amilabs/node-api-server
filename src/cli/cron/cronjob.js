const lockFile = require('lockfile');
const os = require('os');
const { initLogger } = require('logger');
const { initMetric, getStartedTimer } = require('metric');

const DEFAULT_LOCK_RETRY_COUNT = 3;

const DEFAULT_LOCK_DIR_NAME = './.locks';

class CronJob {
    constructor(args, options) {
        const filename = __filename.split('/');
        this.name = options.name || filename[filename.length - 2];
        this.options = options;
        this.args = args;
        this.hostname = options.hostname || os.hostname();
        this.logger = initLogger(options.logger || {
            level: 'debug',
            transports: [{ type: 'Console' }]
        });
        this.metric = initMetric({
            metricPrefix: `${this.hostname}.${this.name}`,
            ...(options.metric || {})
        });
    }

    getLockFilename() {
        return `${this.options.lock.dirname || DEFAULT_LOCK_DIR_NAME}/${this.options.lock.filename
            || `${this.name}.lock`}`;
    }

    async lock() {
        return new Promise((resolve, reject) => {
            lockFile.lock(
                this.getLockFilename(),
                { retries: DEFAULT_LOCK_RETRY_COUNT, ...(this.options.lock.opt || {}) },
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
            lockFile.unlock(this.getLockFilename(), (err) => {
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
        const timer = getStartedTimer('run');
        try {
            await this.lock();
        } catch (e) {
            this.logger.warn(e.toString());
            timer.send('lock');
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
