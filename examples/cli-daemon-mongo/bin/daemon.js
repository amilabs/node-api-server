#!/usr/bin/env node
let api;
try {
    api = require('../../../index'); // eslint-disable-line
} catch (e) {
    console.log(e);
    api = require('api-server'); // eslint-disable-line
}

const { Daemon } = require('../src/daemon');

const { cli: { CliRunner } } = api;

(new CliRunner(Daemon)).run();
