"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/********************
 * The Bridge class *
 ********************/

/**
 * A two-way bridge between Discord and Telegram
 */
class Bridge {
	/**
	 * Creates a new bridge
	 *
	 * @param {String} name	Name of the bridge
	 * @param {Integer} telegramChatId	ID of the Telegram chat to bridge
	 * @param {String} discordChannelId	ID of the Discord channel to bridge
	 * @param {String} discordServerId	ID of the Discord server the channel is on
	 */
	constructor(name, telegramChatId, discordChannelId, discordServerId) {
		/**
		 * Name of the bridge
		 *
		 * @type String
		 */
		this.name = name;

		/**
		 * ID of the Telegram chat to bridge
		 *
		 * @type Integer
		 */
		this.telegramChatId = telegramChatId;

		/**
		 * ID of the Discord channel to bridge
		 *
		 * @type String
		 */
		this.discordServerId = discordServerId;

		/**
		 * ID of the Discord server the channel is on
		 *
		 * @type String
		 */
		this.discordChannelId = discordChannelId;
	}
}

/*************
 * Export it *
 *************/

module.exports = Bridge;
