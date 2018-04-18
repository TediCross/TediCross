"use strict";

/**************************
 * Import important stuff *
 **************************/

const BridgeSettingsTelegram = require("./BridgeSettingsTelegram");
const BridgeSettingsDiscord = require("./BridgeSettingsDiscord");

/********************
 * The Bridge class *
 ********************/

/**
 * A bridge between Discord and Telegram
 */
class Bridge {
	/**
	 * Creates a new bridge
	 *
	 * @param {Object} settings	Settings for the bridge
	 * @param {String} settings.name	Name of the bridge
	 * @param {Object} settings.telegram	Settings for the Telegram side of the bridge. See the constructor for {@link BridgeSettingsTelegram}
	 * @param {Object} settings.discord	Settings for the Discord side of the bridge. See the constructor for {@link BridgeSettingsDiscord}
	 *
	 * @throws {Error}	If the settings object does not validate
	 */
	constructor(settings) {
		// Check that the settings object is valid
		Bridge.validate(settings);

		/**
		 * Name of the bridge
		 *
		 * @type String
		 */
		this.name = settings.name;

		/**
		 * Direction of the bridge
		 *
		 * @type String
		 */
		this.direction = settings.direction;

		/**
		 * Settings for the Telegram side of the bridge
		 *
		 * @type BridgeSettingsTelegram
		 */
		this.telegram = new BridgeSettingsTelegram(settings.telegram);

		/**
		 * Settings for the Discord side of the bridge
		 *
		 * @type Object
		 */
		this.discord = new BridgeSettingsDiscord(settings.discord);
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a Bridge object
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

		// Check the name
		if (typeof settings.name !== "string") {
			throw new Error("`settings.name` must be a string");
		}

		// Check the direction
		if (![Bridge.DIRECTION_BOTH, Bridge.DIRECTION_DISCORD_TO_TELEGRAM, Bridge.DIRECTION_TELEGRAM_TO_DISCORD].includes(settings.direction)) {
			throw new Error("`settings.direction` is not a valid bridge direction");
		}

		// Check the Telegram settings
		BridgeSettingsTelegram.validate(settings.telegram);

		// Check the Discord settings
		BridgeSettingsDiscord.validate(settings.discord);
	}

	/**
	 * Constant for a bidirectional bridge
	 *
	 * @type String
	 */
	static get DIRECTION_BOTH() {
		return "both";
	}

	/**
	 * Constant for a bridge going from Discord to Telegram
	 *
	 * @type String
	 */
	static get DIRECTION_DISCORD_TO_TELEGRAM() {
		return "d2t";
	}

	/**
	 * Constant for a bridge going from Telegram to Discord
	 *
	 * @type String
	 */
	static get DIRECTION_TELEGRAM_TO_DISCORD() {
		return "t2d";
	}
}

/*************
 * Export it *
 *************/

module.exports = Bridge;
