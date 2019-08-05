"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const moment = require("moment");

const dummy = R.always(undefined);

/********************
 * Define the class *
 ********************/

/**
 * Logger utility which works just like the ordinary 'console' but prefixes any message with a timestamp and type of message
 */
// eslint-disable-next-line no-console
class Logger extends console.Console {
	/**
	 * Creates a new logger
	 * @param {Boolean} debug
	 */
	constructor(debug) {
		super(process.stdout, process.stderr);

		this._debugEnabled = debug;

		// Wrap the output methods
		this.log = this._wrapper(this.log, "LOG");
		this.info = this._wrapper(this.info, "INFO");
		this.error = this._wrapper(this.error, "ERR");
		this.warn = this._wrapper(this.warn, "WARN");
		this.debug = this._debugEnabled
			? this._wrapper(this.debug, "DEBUG")
			: dummy;
	}

	/**
	 * Wraps the console print methods so they print a bit more info
	 *
	 * @param {Function} method	The console method to wrap
	 * @param {String} tag	Tag to prefix all calls to this method with
	 *
	 * @returns {Function}	A function which works just like the given method, but also prints extra data
	 *
	 * @private
	 */
	_wrapper(method, tag) {
		return (...args) => {
			// Create the stamp
			const stamp = `${Logger.timestamp} [${tag}]`;
			// Put the stamp as the first argument, preserving the inspection of whatever the first argument is
			return method(stamp, ...args);
		};
	}

	/**
	 * The current timestamp
	 *
	 * @type {String}
	 */
	static get timestamp() {
		return moment().format("YYYY-MM-DD HH:mm:ss");
	}
}

/********************
 * Export the class *
 ********************/

module.exports = Logger;
