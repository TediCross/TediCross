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
	constructor({chatId, relayJoinLeaveMessages}) {
		/**
		 * ID of the Telegram chat to bridge
		 *
		 * @type Integer
		 */
		this.chatId = Number.parseInt(chatId);

		/**
		 * Whether or not to relay join/leave messages from Telegram to Discord
		 *
		 * @type Boolean
		 */
		this.relayJoinLeaveMessages = relayJoinLeaveMessages;
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeSettingsTelegram;
