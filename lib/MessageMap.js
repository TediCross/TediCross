"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/********************
 * Create the class *
 ********************/

/**
 * Handle for the one and only instance
 */
let instance = null;

/**
 * Handles mapping between message IDs in discord and telegram, for message editing purposes
 */
class MessageMap {
	constructor() {
		// Check if the instance exists
		if (instance !== null) {
			throw new Error("Instance already exists");
		}

		// This is the one and only instance
		instance = this;

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
		let key = `${direction} ${fromId}`;

		// Make the mapping
		this._map.set(key, toId);

		// Start a timeout deleting the mapping after 24 hours
		setTimeout(() => this._map.delete(key), 1000*60*60*24);
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
		let toId = this._map.get(`${direction} ${fromId}`);
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

	/**
	 * The existing instance
	 */
	static get instance() {
		// If the instance does not exist, create it before returning it
		if (instance === null) {
			new MessageMap();	// The constructor sets the instance variable
		}
		return instance;
	}
}

/********************
 * Export the class *
 ********************/

module.exports = MessageMap;
