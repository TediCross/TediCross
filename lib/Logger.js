"use strict";

/**************************
 * Import important stuff *
 **************************/

const moment = require("moment");
const stream = require("stream");

/********************
 * Define the class *
 ********************/

/**
 * Logger utility which works just like the ordinary 'console' but prefixes any message with a timestamp and type of message
 */
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

	_wrapper(method, tag) {
		return (firstArg, ...restArgs) => {
			// Create the stamp
			const stamp = `${Logger.timestamp} [${tag}]`;

			// Check how to apply the stamp
			let result = null;
			if (typeof firstArg === "string") {
				// Prefix the stamp, preserving any substitutions
				result = method(`${stamp}\t${firstArg}`, ...restArgs);
			} else {
				// Put the stamp as the first argument, preserving the inspection of whatever the first argument is
				result = method(stamp, firstArg, ...restArgs);
			}

			return result;
		}
	}

	/**
	 * The current timestamp
	 */
	static get timestamp() {
		return moment().format("YYYY-MM-DD HH:mm:ss");
	}
}

/********************
 * Export the class *
 ********************/

module.exports = Logger;
