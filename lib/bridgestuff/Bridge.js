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
	 */
	constructor(settings) {
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
