"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/************************************
 * The BridgeSettingsTelegram class *
 ************************************/

/**
 * Holds settings for the Telegram part of a bridge
 */
class BridgeSettingsTelegram {
	/**
	 * Creates a new BridgeSettingsTelegram object
	 *
	 * @param {Object} settings	Settings for the Telegram side of the bridge
	 * @param {Integer} settings.chatId	ID of the Telegram chat to bridge
	 * @param {Boolean} settings.relayJoinMessages	Whether or not to relay join messages from Telegram to Discord
	 * @param {Boolean} settings.relayLeaveMessages	Whether or not to relay leave messages from Telegram to Discord
	 */
	constructor(settings) {
		// Check that the settings object is valid
		BridgeSettingsTelegram.validate(settings);

		/**
		 * ID of the Telegram chat to bridge
		 *
		 * @type {Integer}
		 */
		this.chatId = Number.parseInt(settings.chatId);

		/**
		 * Whether or not to relay join messages from Telegram to Discord
		 *
		 * @type {Boolean}
		 */
		this.relayJoinMessages = settings.relayJoinMessages;

		/**
		 * Whether or not to relay join messages from Telegram to Discord
		 *
		 * @type {Boolean}
		 */
		this.relayLeaveMessages = settings.relayLeaveMessages;

		/**
		 * Whether or not to send the user's name as part of the messages to Discord
		 *
		 * @type {Boolean}
		 */
		this.sendUsernames = settings.sendUsernames;

		/**
		 * Whether or not to relay messages starting with "/" (commands)
		 *
		 * @type {Boolean}
		 */
		this.relayCommands = settings.relayCommands;

		/**
		 * Whether or not to delete messages when they are edited to be a single dot
		 *
		 * @type {Boolean}
		 */
		this.crossDeleteOnDiscord = settings.crossDeleteOnDiscord;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a BridgeSettingsTelegram object
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

		// Check that relayJoinMessages is a boolean
		if (Boolean(settings.relayJoinMessages) !== settings.relayJoinMessages) {
			throw new Error("`settings.relayJoinMessages` must be a boolean");
		}

		// Check that relayLeaveMessages is a boolean
		if (Boolean(settings.relayLeaveMessages) !== settings.relayLeaveMessages) {
			throw new Error("`settings.relayLeaveMessages` must be a boolean");
		}

		// Check that sendUsernames is a boolean
		if (Boolean(settings.sendUsernames) !== settings.sendUsernames) {
			throw new Error("`settings.sendUsernames` must be a boolean");
		}

		// Check that relayCommands is a boolean
		if (Boolean(settings.relayCommands) !== settings.relayCommands) {
			throw new Error("`settings.relayCommands` must be a boolean");
		}

		// Check that crossDeleteOnDiscord is a boolean
		if (Boolean(settings.crossDeleteOnDiscord) !== settings.crossDeleteOnDiscord) {
			throw new Error("`settings.crossDeleteOnDiscord` must be a boolean");
		}
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeSettingsTelegram;
