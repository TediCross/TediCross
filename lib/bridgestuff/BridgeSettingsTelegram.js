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
	 * @param {Boolean} settings.relayJoinLeaveMessages	Whether or not to relay join/leave messages from Telegram to Discord
	 */
	constructor(settings) {
		// Check that the settings object is valid
		BridgeSettingsTelegram.validate(settings);

		/**
		 * ID of the Telegram chat to bridge
		 *
		 * @type Integer
		 */
		this.chatId = settings.chatId;

		/**
		 * Whether or not to relay join/leave messages from Telegram to Discord
		 *
		 * @type Boolean
		 */
		this.relayJoinLeaveMessages = settings.relayJoinLeaveMessages;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a BridgeSettingsTelegram object
	 *
	 * @param {Object} settings	The object to validate
	 *
	 * @throws {Error}	If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings) {
		// Check that the settings are indeed in object form
		if (!(settings instanceof Object)) {
			throw new Error("`settings` must be an object");
		}

		// Check that the chat ID is an integer
		if (!Number.isInteger(settings.chatId)) {
			throw new Error("`settings.chatId` must be an integer");
		}

		// Check that relayJoinLeaveMessages is a boolean
		if (Boolean(settings.relayJoinLeaveMessages) !== settings.relayJoinLeaveMessages) {
			throw new Error("`settings.relayJoinLeaveMessages` must be a boolean");
		}
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeSettingsTelegram;
