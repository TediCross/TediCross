"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/***********************************
 * The BridgeSettingsDiscord class *
 ***********************************/

/**
 * Holds settings for the Discord part of a bridge
 */
class BridgeSettingsDiscord {
	/**
	 * Creates a new BridgeSettingsDiscord object
	 *
	 * @param {Object} settings	Settings for the Discord side of the bridge
	 * @param {String} settings.serverId	ID of the Discord server this bridge is part of
	 * @param {String} settings.channelId	ID of the Discord channel this bridge is part of
	 * @param {Boolean} settings.relayJoinLeaveMessages	Whether or not to relay join/leave messages from Discord to Telegram
	 */
	constructor({serverId, channelId, relayJoinLeaveMessages}) {
		/**
		 * ID of the Discord server this bridge is part of
		 *
		 * @type String
		 */
		this.serverId = serverId;

		/**
		 * ID of the Discord channel this bridge is part of
		 *
		 * @type String
		 */
		this.channelId = channelId;

		/**
		 * Whether or not to relay join/leave messages from Discord to Telegram
		 *
		 * @type Boolean
		 */
		this.relayJoinLeaveMessages = relayJoinLeaveMessages;
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeSettingsDiscord;
