"use strict";

const util = require("util");
const R = require("ramda");
const moment = require("moment");

/**
 * Makes a promise which resolves after a set number of milliseconds
 *
 * @param {Integer} ms	Number of milliseconds to slieep
 * @param {Any} [arg]	Optional argument to resolve the promise to
 *
 * @returns {Promise}	Promise resolving after the given number of ms
 */
const sleep = util.promisify(setTimeout);

/**
 * Makes a promise which resolves after one minute
 *
 * @param {Any} [arg]	Optional argument to resolve the promise to
 *
 * @returns {Promise}	Promise resolving after one minute
 */
const sleepOneMinute = R.partial(sleep, [moment.duration(1, "minute").asMilliseconds()]);

module.exports = {
	sleep,
	sleepOneMinute
};
