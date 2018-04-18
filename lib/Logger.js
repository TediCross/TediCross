"use strict";

/**************************
 * Import important stuff *
 **************************/

const moment = require("moment");

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
	 */
	constructor() {
		super(process.stdout, process.stderr);

		// Wrap the output methods
		this.log = this._wrapper(this.log, "LOG");
		this.info = this._wrapper(this.info, "INFO");
		this.error = this._wrapper(this.error, "ERR");
		this.warn = this._wrapper(this.warn, "WARN");
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
		return (firstArg, ...restArgs) => {
			// Create the stamp
			const stamp = `${Logger.timestamp} [${tag}]`;

			// Check how to apply the stamp
			let result = null;
			if (typeof firstArg === "string") {
				// Prepend it to the text with a tab between
				result = method(`${stamp}\t${firstArg}`, ...restArgs);
			} else {
				// Put the stamp as the first argument, preserving the inspection of whatever the first argument is
				result = method(stamp, "\t", firstArg, ...restArgs);
			}

			return result;
		};
	}

	/**
	 * The current timestamp
	 *
	 * @type String
	 */
	static get timestamp() {
		return moment().format("YYYY-MM-DD HH:mm:ss");
	}
}

/********************
 * Export the class *
 ********************/

module.exports = Logger;
