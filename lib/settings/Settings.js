"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const _ = require("lodash");
const Bridge = require("../bridgestuff/Bridge");
const TelegramSettings = require("./TelegramSettings");
const DiscordSettings = require("./DiscordSettings");
const jsYaml = require("js-yaml");

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
	 * @param {Object} settings	The raw settings object to use
	 * @param {Object} settings.telegram	Settings for the Telegram bot. See the constructor of {@link TelegramSettings}
	 * @param {Object} settings.discord	Settings for the Discord bot. See the constructor of {@link DiscordSettings}
	 * @param {Object[]} settings.bridges	Settings for the bridges. See the constructor of {@link Bridge}
	 * @param {Boolean} settings.debug	Whether or not to print debug messages
	 *
	 * @throws {Error}	If the raw settings object does not validate
	 */
	constructor(settings) {
		// Make sure the settings are valid
		Settings.validate(settings);

		/**
		 * The settings for the Telegram bot
		 *
		 * @type TelegramSettings
		 */
		this.telegram = new TelegramSettings(settings.telegram);

		/**
		 * The settings for the Discord bot
		 *
		 * @type DiscordSettings
		 */
		this.discord = new DiscordSettings(settings.discord);

		/**
		 * Whether or not to print debug messages
		 *
		 * @type Boolean
		 */
		this.debug = settings.debug;

		/**
		 * The config for the bridges
		 *
		 * @type Object[]
		 */
		this.bridges = settings.bridges;
	}

	/**
	 * Saves the settings to file
	 *
	 * @param {String} filepath	Filepath to save to. Absolute path is recommended
	 */
	toFile(filepath) {
		// The raw object is not suitable for YAML-ification. A few `toJSON()` methods will not be triggered that way. Go via JSON
		const objectToSave = JSON.parse(JSON.stringify(this));

		// Convert the object to quite human-readable YAML and write it to the file
		const yaml = jsYaml.safeDump(objectToSave);
		fs.writeFileSync(filepath, yaml);
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a Settings object
	 *
	 * @param {Object} settings	The object to validate
	 *
	 * @throws {Error}	If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings) {
		// Check that the settings are indeed in object form
		if (!(settings instanceof Object)) {
			throw new Error("`settings` must be an object");
		}

		// Check that debug is a boolean
		if (Boolean(settings.debug) !== settings.debug) {
			throw new Error("`settings.debug` must be a boolean");
		}

		// Check that `bridges` is an array
		if (!(settings.bridges instanceof Array)) {
			throw new Error("`settings.bridges` must be an array");
		}

		// Check that the bridges are valid
		settings.bridges.forEach(Bridge.validate);
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
			settings.bridges = settings.bridgeMap;

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

		// Get rid of the `telegram.auth` object
		if (settings.telegram.auth !== undefined) {
			settings.telegram.token = settings.telegram.auth.token;
			delete settings.telegram.auth;
		}

		// Get rid of the `discord.auth` object
		if (settings.discord.auth !== undefined) {
			settings.discord.token = settings.discord.auth.token;
			delete settings.discord.auth;
		}

		// Get rid of the `telegram.commaAfterSenderName` property
		if (settings.telegram.commaAfterSenderName !== undefined) {
			delete settings.telegram.commaAfterSenderName;
		}

		// Split the `relayJoinLeaveMessages`
		for (const bridge of settings.bridges) {
			// Do the Telegram part
			if (bridge.telegram.relayJoinLeaveMessages !== undefined) {
				bridge.telegram.relayJoinMessages = bridge.telegram.relayJoinLeaveMessages;
				bridge.telegram.relayLeaveMessages = bridge.telegram.relayJoinLeaveMessages;
				delete bridge.telegram.relayJoinLeaveMessages;
			}

			// Do the Discord part
			if (bridge.discord.relayJoinLeaveMessages !== undefined) {
				bridge.discord.relayJoinMessages = bridge.discord.relayJoinLeaveMessages;
				bridge.discord.relayLeaveMessages = bridge.discord.relayJoinLeaveMessages;
				delete bridge.discord.relayJoinLeaveMessages;
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
	 * @throws	If the file does not contain a YAML object, or it cannot be read/written
	 */
	static fromFile(filepath) {
		// Read the file
		let contents = null;
		try {
			contents = fs.readFileSync(filepath);
		} catch (err) {
			// Could not read it. Check if it exists
			if (err.code === "ENOENT") {
				// It didn't. Claim it contained an empty YAML object
				contents = jsYaml.safeDump({});

				// ...and make it so that it actually does
				fs.writeFileSync(filepath, contents);
			} else {
				// Pass the error on
				throw err;
			}
		}

		// Parse the contents as YAML
		let settings = jsYaml.safeLoad(contents);

		// Assign defaults and migrate to newest format
		settings = Settings.applyDefaults(settings);
		settings = Settings.migrate(settings);

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
			telegram: TelegramSettings.DEFAULTS,
			discord: DiscordSettings.DEFAULTS,
			bridges: [],
			debug: false
		};
	}
}

/********************
 * Export the class *
 ********************/

module.exports = Settings;
