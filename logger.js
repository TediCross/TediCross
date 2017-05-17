"use strict";

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
		// Get the time right now
		const now = new Date();

		// Process it into YYYY-MM-DD HH:mm:ss
		let stamp = now.getFullYear();
		stamp += "-" + now.getMonth()+1;
		stamp += "-" + now.getDate();
		stamp += " " + now.getHours();
		stamp += ":" + now.getMinutes();
		stamp += ":" + now.getSeconds();

		return stamp;
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
