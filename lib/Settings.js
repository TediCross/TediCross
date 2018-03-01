"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const Bridge = require("./Bridge");

const Application = require("./Application");

/**********************
 * The Settings class *
 **********************/

/**
 * Settings class for TediCross
 */
class Settings {
	/**
	 * Creates a new settings object
	 *
	 * @param {Object} rawSettings	A raw settings object parsed from file
	 */
	constructor(rawSettings) {
		// Make sure the raw settings have default values
		let settings = Settings.applyDefaults(rawSettings);

		// Migrate settings to the newest format
		settings = Settings.migrate(settings);

		// Assign everything to this object
		_.assign(this, settings);
	}

	/**
	 * Saves the settings to file
	 *
	 * @param {String} filepath	Filepath to save to. Absolute path is recommended
	 */
	toFile(filepath) {
		// Convert the settings to somewhat human-readable JSON
		const json = JSON.stringify(this, null, "\t");

		// Save it
		fs.writeFileSync(filepath, json);
	}

	/**
	 * The bot token to use for Telegram. Use this instead of `settings.telegram.auth.token`
	 *
	 * @type String
	 */
	get telegramToken() {
		return this.telegram.auth.token === "env"
		  ? process.env.TELEGRAM_BOT_TOKEN
		  : this.telegram.auth.token
		;
	}
	set telegramToken(newToken) {
		this.telegram.auth.token = newToken;
	}

	/**
	 * The bot token to use for Discord. Use this instead of `settings.discord.auth.token`
	 *
	 * @type String
	 */
	get discordToken() {
		return this.discord.auth.token === "env"
		  ? process.env.DISCORD_BOT_TOKEN
		  : this.discord.auth.token
		;
	}
	set discordToken(newToken) {
		this.discord.auth.token = newToken;
	}

	/**
	 * Merges a raw settings object with default values
	 *
	 * @param {Object} rawSettings	The raw settings object to merge
	 *
	 * @returns {Object}	A clone of the provided object, with default values on it
	 */
	static applyDefaults(rawSettings) {
		return _.defaultsDeep(_.clone(rawSettings), Settings.DEFAULTS);
	}

	/**
	 * Migrates settings to the newest format
	 *
	 * @param {Object} rawSettings	The raw settings object to migrate
	 *
	 * @returns {Object}	A new object on the newest format
	 */
	static migrate(rawSettings) {
		// Make a clone, to not operate directly on the provided object
		const settings = _.clone(rawSettings);

		// Check if the bridge map exists
		if (settings.bridgeMap === undefined || settings.bridgeMap.length === 0) {

			// Check if a bridge on the old format should be migrated
			const migrate = (
				settings.telegram.chatID !== undefined ||
				settings.discord.serverID !== undefined ||
				settings.discord.channelID !== undefined
			);

			if (migrate) {
				// Migrate the old settings to the bridge map
				settings.bridgeMap = [
					{
						name: "Migrated bridge",
						telegram: settings.telegram.chatID,
						discord: {
							guild: settings.discord.serverID,
							channel: settings.discord.channelID
						}
					}
				];

				// Delete the old properties
				delete settings.telegram.chatID;
				delete settings.discord.serverID;
				delete settings.discord.channelID;
			}
		}

		// ...and convert `bridgeMap` to just `bridges`
		if (settings.bridgeMap !== undefined) {

			// Move it
			settings.bridges = settings.bridgeMap

			// Delete the old property
			delete settings.bridgeMap;
		}

		// Convert the bridge objects if necessary
		for (const bridge of settings.bridges) {
			if (!(bridge.telegram instanceof Object)) {
				bridge.telegram = {
					chatId: bridge.telegram,
					relayJoinLeaveMessages: true
				};
				bridge.discord = {
					serverId: bridge.discord.guild,
					channelId: bridge.discord.channel,
					relayJoinLeaveMessages: true
				};
			}

			// Default to bidirectional bridges
			if (bridge.direction === undefined) {
				bridge.direction = Bridge.DIRECTION_BOTH;
			}
		}

		// All done!
		return settings;
	}

	/**
	 * Creates a new settings object from file
	 *
	 * @param {String} filepath	Path to the settings file to use. Absolute path is recommended
	 *
	 * @returns {Settings}	A settings object
	 *
	 * @throws	If the file does not contain a JSON object, or it cannot be read/written
	 */
	static fromFile(filepath) {
		// Read the file
		let contents = null;
		try {
			contents = fs.readFileSync(filepath);
		} catch (err) {
			// Could not read it. Check if it exists
			if (err.code === "ENOENT") {
				// Yup. Claim it contained an empty JSON object
				contents = JSON.stringify({});

				// ...and make it so that it actually does
				fs.writeFileSync(filepath, contents);
			} else {
				// Pass the error on
				throw err;
			}
		}

		// Parse the contents as JSON
		const settings = JSON.parse(contents);

		// Create and return the settings object
		return new Settings(settings);
	}

	/**
	 * Default settings
	 *
	 * @type Object
	 */
	static get DEFAULTS() {
		return {
			telegram: {
				auth: {
					token: "env"
				},
				useFirstNameInsteadOfUsername: false,
				commaAfterSenderName: false,
				colonAfterSenderName: false,
				skipOldMessages: true,
				sendEmojiWithStickers: true
			},
			discord: {
				auth: {
					token: "env"
				},
				skipOldMessages: true
			},
			bridges: [],
			debug: false
		};
	}
}

/********************
 * Export the class *
 ********************/

module.exports = Settings;
