"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const path = require("path");
const Application = require("../Application");

/*************************************
 * The LatestDiscordMessageIds class *
 *************************************/

/**
 * Persistently keeps track of the ID of the latest Discord message per bridge
 */
class LatestDiscordMessageIds {
	/**
	 * Creates a new instance which keeps track of messages and bridges
	 *
	 * @param {String} filename	Name of the file to persistently store the map in. Will be put in the `data/` directory
	 */
	constructor(filename) {
		/**
		 * The path of the file this map is connected to
		 *
		 * @type String
		 *
		 * @private
		 */
		this._filename = path.join(__dirname, "..", "..", "data", filename);

		/**
		 * The actual map
		 *
		 * @type Object
		 *
		 * @private
		 */
		this._map = {};

		try {
			// Check if the file exists. This throws if it doesn't
			fs.accessSync(this._filename, fs.constants.F_OK);
		} catch (e) {
			// Nope, it doesn't. Create it
			fs.writeFileSync(this._filename, JSON.stringify({}));
		}

		// Read the file
		let data = null;
		try {
			data = fs.readFileSync(this._filename);
		} catch (err) {
			// Well, the file has been confirmed to exist, so there must be no read access
			Application.logger.error(`Cannot read the file ${this._filename}:`, err);
			data = JSON.stringify({});
		}

		try {
			// Read the contents as JSON
			this._map = JSON.parse(data);
		} catch (err) {
			// Invalid JSON
			Application.logger.error(`Could not read or parse the file ${this._filename}:`, err);
			this._map = {};
		}

		/**
		 * Promise which resolves when writing has finished. Meant to be chained with every write operation
		 *
		 * @type Promise
		 *
		 * @private
		 */
		this._finishedWriting = Promise.resolve();

		// Bind methods to avoid problems with `this`
		this.setLatest = this.setLatest.bind(this);
		this.getLatest = this.getLatest.bind(this);
	}

	/**
	 * Tells the map the latest message for a bridge
	 *
	 * @param {String} message	The latest message from Discord on the bridge
	 * @param {Object} bridge	The bridge
	 */
	setLatest(messageId, bridge) {
		// Update the bridge map
		this._map[bridge.name] = messageId;

		// Write it to file when previous writes have completed
		this._finishedWriting = this._finishedWriting
			.then(() => new Promise((resolve, reject) => {
				fs.writeFile(this._filename, JSON.stringify(this._map, null, "\t"), (err) => err ? reject(err) : resolve());
			}))
			.catch((err) => Application.logger.error("Writing last Discord message ID to file failed!", err));
	}

	/**
	 * Gets the latest message ID for a bridge, or `null` if none was found
	 *
	 * @param {Object} bridge	The bridge to get the message ID from
	 *
	 * @returns {String}	ID of the latest Discord message that passed over the bridge
	 */
	getLatest(bridge) {
		return this._map[bridge.name] === undefined ? null : this._map[bridge.name];
	}
}

/*************
 * Export it *
 *************/

module.exports = LatestDiscordMessageIds;
