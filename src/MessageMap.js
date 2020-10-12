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

		/**
		 * The timeout map
		 *
		 * @private
		 */
		this._timeoutMap = new Map();
	}

	/**
	 * Inserts a mapping into the map
	 *
	 * @param {String} direction	One of the two direction constants of this class
	 * @param {Bridge} bridge	The bridge this mapping is for
	 * @param {String} fromId	Message ID to map from, i.e. the ID of the message the bot received
	 * @param {String} toId	Message ID to map to, i.e. the ID of the message the bot sent
	 */
	insert(direction, bridge, fromId, toId) {
		// Get/create the entry for the bridge
		let keyToIdsMap = this._map.get(bridge);
		if (keyToIdsMap === undefined) {
			keyToIdsMap = new Map();
			this._map.set(bridge, keyToIdsMap);
		}

		// Generate the key and get the corresponding IDs
		const key = `${direction} ${fromId}`;
		let toIds = keyToIdsMap.get(key);
		if (toIds === undefined) {
			toIds = new Set();
			keyToIdsMap.set(key, toIds);
		}

		// Shove the new ID into it
		toIds.add(toId);

		// Start a timeout removing it again after 24 hours
		setTimeout(() => {
			keyToIdsMap.delete(key);
		}, moment.duration(24, "hours").asMilliseconds());
	}

	/**
	 * Gets the ID of a message the bot sent based on the ID of the message the bot received
	 *
	 * @param {String} direction	One of the two direction constants of this class
	 * @param {Bridge} bridge	The bridge this mapping is for
	 * @param {String} fromId	Message ID to get corresponding ID for, i.e. the ID of the message the bot received the message
	 *
	 * @returns {String[]}	Message IDs of the corresponding message, i.e. the IDs of the messages the bot sent
	 */
	getCorresponding(direction, bridge, fromId) {
		try {
			// Get the key-to-IDs map
			const keyToIdsMap = this._map.get(bridge);

			// Create the key
			const key = `${direction} ${fromId}`;

			// Extract the IDs
			const toIds = keyToIdsMap.get(key);

			// Return the ID
			return [...toIds];
		} catch (err) {
			// Unknown message ID. Don't do anything
			return [];
		}
	}

	getCorrespondingReverse(direction, bridge, toId) {
		// The ID to return
		let fromId = [];

		// Get the mappings for this bridge
		const keyToIdsMap = this._map.get(bridge);
		if (keyToIdsMap !== undefined) {
			// Find the ID
			const [key] = [...keyToIdsMap].find(([, ids]) => ids.has(toId));
			fromId = key.split(" ");
			fromId.shift();
		}

		return fromId;
	}

	/**
	 * Constant indicating direction discord to telegram
	 */
	static get DISCORD_TO_TELEGRAM() {
		return "d2t";
	}

	/**
	 * Constant indicating direction telegram to discord
	 */
	static get TELEGRAM_TO_DISCORD() {
		return "t2d";
	}
}

/********************
 * Export the class *
 ********************/

module.exports = MessageMap;
