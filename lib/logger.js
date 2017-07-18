"use strict";

/**************************
 * Import important stuff *
 **************************/

const moment = require("moment");

/**
 * Logger utility which basically just prefixes any message with a timestamp and something else something
 */
class Logger {
	/**
	 * Create a new logger
	 *
	 * @param {String} prefix	The prefix to prepend to all messages
	 */
	constructor(prefix) {
		this.prefix = prefix;
	}

	/**
	 * Gets the timestamp in a readable format
	 */
	static get timestamp() {
		return moment().toISOString();
	}

	/**
	 * Pretty much the same as console.log()
	 */
	log(...args) {
		console.log(Logger.timestamp, this.prefix, ...args);
	}

	/**
	 * Pretty much the same as console.error()
	 */
	error(...args) {
		console.error(Logger.timestamp, this.prefix, ...args);
	}
}

/********************
 * Export the class *
 ********************/

module.exports = Logger;
