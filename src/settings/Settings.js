"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const R = require("ramda");
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
		 * @type {TelegramSettings}
		 */
		this.telegram = new TelegramSettings(settings.telegram);

		/**
		 * The settings for the Discord bot
		 *
		 * @type {DiscordSettings}
		 */
		this.discord = new DiscordSettings(settings.discord);

		/**
		 * Whether or not to print debug messages
		 *
		 * @type {Boolean}
		 */
		this.debug = settings.debug;

		/**
		 * The config for the bridges
		 *
		 * @type {Object[]}
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
		const notepadFriendlyYaml = yaml.replace(/\n/g, "\r\n");
		fs.writeFileSync(filepath, notepadFriendlyYaml);
	}

	/**
	 * Makes a raw settings object from this object
	 *
	 * @returns {Object}	A plain object with the settings
	 */
	toObj() {
		// Hacky way to turn this into a plain object...
		return JSON.parse(JSON.stringify(this));
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
		return R.mergeDeepLeft(rawSettings, Settings.DEFAULTS);
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
		const settings = R.clone(rawSettings);

		// 2019-11-08: Turn `ignoreCommands` into `relayCommands`, as `ignoreCommands` accidently did the opposite of what it was supposed to do
		for (const bridge of settings.bridges) {
			if (R.isNil(bridge.telegram.relayCommands)) {
				bridge.telegram.relayCommands = bridge.telegram.ignoreCommands;
			}
			delete bridge.telegram.ignoreCommands;
		}

		// 2019-11-08: Remove the `serverId` setting from the discord part of the bridges
		for (const bridge of settings.bridges) {
			delete bridge.discord.serverId;
		}

		// 2020-02-09: Removed the `displayTelegramReplies` option from Discord
		if (!R.isNil(settings.discord.displayTelegramReplies)) {
			delete settings.discord.displayTelegramReplies;
		}

		// 2020-06-30: Added `bridge.telegram.crossDeleteOnDiscord` option
		for (const bridge of settings.bridges) {
			if (R.isNil(bridge.telegram.crossDeleteOnDiscord)) {
				bridge.telegram.crossDeleteOnDiscord = true;
			}
		}

		// All done!
		return settings;
	}

	/**
	 * Creates a new settings object from a plain object
	 *
	 * @param {Object} obj	The object to create a settings object from
	 *
	 * @returns {Settings}	The settings object
	 */
	static fromObj(obj) {
		return R.compose(
			R.construct(Settings),
			Settings.migrate,
			Settings.applyDefaults
		)(obj);
	}

	/**
	 * Default settings
	 *
	 * @type {Object}
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
