"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const _ = require("lodash");
const Application = require("../Application");

/****************************
 * The DiscordUserMap class *
 ****************************/

/**
 * Handles the mapping between UserID and Username in Discord and saves it to a file when it changes
 */
class DiscordUserMap {
	/**
	 * Creates a new mapping betweein user IDs and usernames
	 *
	 * @param {String} filename	Name of the file read the map from and store it to
	 */
	constructor(filename) {
		/**
		 * The filename this map is associated with
		 *
		 * @private
	 	 */
		this._filename = filename;

		try {
			// Check if the file exists. This throws if it doesn't
			fs.accessSync(this._filename, fs.constants.F_OK);
		} catch (err) {
			// Nope, it doesn't. Create it
			Application.logger.log(`Creating the file ${this._filename}`);
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

		// Parse it as JSON
		try {
			data = JSON.parse(data);
		} catch (err) {
			// Invalid JSON. Log it, and start with an empty object
			Application.logger.warn(`Invalid JSON in ${this._filename}. Starting with empty usermap`);
			data = {};
		}

		/**
		 * The mapping between IDs and names
		 *
		 * @private
		 */
		this._idToName = data;

		/**
		 * The mapping between names and IDs
		 *
		 * @private
		 */
		this._nameToId = {};
		for (const id in data) {
			this._nameToId[data[id].toLowerCase()] = id;
		}

		/**
		 * A promise which resolves to nothing when the file is ready for writing
		 *
		 * @private
		 */
		this._finishedWriting = Promise.resolve();

		// Make the _saveMap method debounced, to not save every damn change
		this._saveMap = _.debounce(this._saveMap, 500);
	}

	/**
	 * Writes the current map to file
	 *
	 * @private
	 */
	_saveMap() {
		// Create the next "finishedWriting" promise
		this._finishedWriting = this._finishedWriting.then(() => new Promise((resolve, reject) => {
			// Write the map to file
			fs.writeFile(this._filename, JSON.stringify(this._idToName, null, "\t"), {encoding: "utf-8"}, (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		}))
		// Log an error if the write failed
			.catch((err) => Application.logger.error("Writing discord user map failed!", err));
	}

	/**
	 * Maps a username to an ID. Example: nameMap.mapUsername("Foo").toID(123);
	 *
	 * @param {String} username	The username to map to an ID
	 *
	 * @return {Object}	An object with a 'toID' property, which is used to complete the mapping
	 */
	mapUsername(username) {
		return {
			toID: (id) => {
				// Check if the mapping exists
				if (this._nameToId[username] !== id) {
					// Nope. Create or update it
					this._nameToId[username.toLowerCase()] = id;
					this._idToName[id] = username;

					// Save it
					this._saveMap();
				}
			}
		};
	}

	/**
	 * Maps an ID to a username. Example: nameMap.mapID(123).toUsername("Foo");
	 *
	 * @param {String} id	The ID to map to a username
	 *
	 * @return {Object}	An object with a 'toUsername' property, which is used to complete the mapping
	 */
	mapID(id) {
		return {
			toUsername: (username) => {
				// Check if the mapping exists
				if (this._idToName[id] !== username) {
					// Nope. Create or update it
					this._nameToId[username.toLowerCase()] = id;
					this._idToName[id] = username;

					// Save it
					this._saveMap();
				}
			}
		};
	}

	/**
	 * Looks up an ID and returns a username
	 *
	 * @param {String} id	The ID to look up
	 *
	 * @return {String}	The username this ID belongs to
	 */
	lookupID(id) {
		return this._idToName[id];
	}

	/**
	 * Looks up a username and returns an ID
	 *
	 * @param {String} username	The name to look up
	 *
	 * @return {String}	The ID this username belongs to
	 */
	lookupUsername(username) {
		return this._nameToId[username.toLowerCase()];
	}

	/**
	 * The filename this map is linked to
	 */
	get filename() {
		return this._filename;
	}

	/**
	 * The mapping between names and IDs
	 */
	get nameToIdMap() {
		return _.clone(this._nameToId);
	}

	/**
	 * The mapping between IDs and names
	 */
	get idToNameMap() {
		return _.clone(this._idToName);
	}
}

/********************
 * Export the class *
 ********************/

module.exports = DiscordUserMap;
