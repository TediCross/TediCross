"use strict";

/**************************
 * Import important stuff *
 **************************/

const moment = require("moment");

/********************
 * Create the class *
 ********************/

/**
 * Handles mapping between message IDs in discord and telegram, for message editing purposes
 */
class MessageMap {
	constructor() {
		/**
		 * The map itself
		 *
		 * @private
		 */
		this._map = new Map();
	}

	/**
	 * Inserts a mapping into the map
	 *
	 * @param {String} direction	One of the two direction constants of this class
	 * @param {String} fromId	Message ID to map from, i.e. the ID of the message the bot received
	 * @param {String} toId	Message ID to map to, i.e. the ID of the message the bot sent
	 */
	insert(direction, fromId, toId) {
		// Generate the key
		const key = `${direction} ${fromId}`;

		// Make the mapping
		this._map.set(key, toId);

		// Start a timeout deleting the mapping after 24 hours
		setTimeout(() => this._map.delete(key), moment.duration(24, "hours").asMilliseconds());
	}

	/**
	 * Gets the ID of a message the bot sent based on the ID of the message the bot received
	 *
	 * @param {String} direction	One of the two direction constants of this class
	 * @param {String} fromId	Message ID to get corresponding ID for, i.e. the ID of the message the bot received the message
	 *
	 * @returns {String}	Message ID of the corresponding message, i.e. the ID of the message the bot sent
	 */
	getCorresponding(direction, fromId) {
		// Try to get the mapping
		const toId = this._map.get(`${direction} ${fromId}`);
		if (toId === undefined) {
			// The mapping doesn't exist
			throw new Error(`No corresponding message ID for ${fromId}`);
		}

		// Return the ID
		return toId;
	}

	/**
	 * Constant indicating direction discord to telegram
	 */
	static get DISCORD_TO_TELEGRAM() {
		return "dt";
	}

	/**
	 * Constant indicating direction telegram to discord
	 */
	static get TELEGRAM_TO_DISCORD() {
		return "td";
	}
}

/********************
 * Export the class *
 ********************/

module.exports = MessageMap;
