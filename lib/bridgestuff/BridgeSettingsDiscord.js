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
	 *
	 * @throws {Error}	If the settings object does not validate
	 */
	constructor(settings) {
		BridgeSettingsDiscord.validate(settings);

		/**
		 * ID of the Discord server this bridge is part of
		 *
		 * @type String
		 */
		this.serverId = settings.serverId;

		/**
		 * ID of the Discord channel this bridge is part of
		 *
		 * @type String
		 */
		this.channelId = settings.channelId;

		/**
		 * Whether or not to relay join/leave messages from Discord to Telegram
		 *
		 * @type Boolean
		 */
		this.relayJoinLeaveMessages = settings.relayJoinLeaveMessages;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a BridgeSettingsDiscord object
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

		// Check that the channel ID is a number, or convertible to a number
		if (typeof settings.channelId !== "string") {
			throw new Error("`settings.channelId` must be a string");
		}

		// Check that the server ID is a number, or convertible to a number
		if (typeof settings.serverId !== "string") {
			throw new Error("`settings.serverId` must be a string");
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

module.exports = BridgeSettingsDiscord;
