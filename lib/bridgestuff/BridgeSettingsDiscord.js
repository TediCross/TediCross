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
	 * @param {Boolean} settings.relayJoinMessages	Whether or not to relay join messages from Discord to Telegram
	 * @param {Boolean} settings.relayLeaveMessages	Whether or not to relay leave messages from Discord to Telegram
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
		 * Whether or not to relay join messages from Discord to Telegram
		 *
		 * @type Boolean
		 */
		this.relayJoinMessages = settings.relayJoinMessages;

		/**
		 * Whether or not to relay leave messages from Discord to Telegram
		 *
		 * @type Boolean
		 */
		this.relayLeaveMessages = settings.relayLeaveMessages;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a BridgeSettingsDiscord object
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
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeSettingsDiscord;
