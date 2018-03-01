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
	 * @param {Object} bridgeSettings	Settings for the bridge
	 * @param {String} bridgeSettings.name	Name of the bridge
	 * @param {Object} bridgeSettings.telegram	Settings for the Telegram side of the bridge
	 * @param {Integer} bridgeSettings.telegram.chatId	ID of the Telegram chat this bridge is part of
	 * @param {Boolean} bridgeSettings.telegram.relayJoinLeaveMessages	Whether or not to relay join/leave messages from Telegram to Discord
	 * @param {Object} bridgeSettings.discord	Settings for the Discord side of the bridge
	 * @param {String} bridgeSettings.discord.serverId	ID of the Discord server this bridge is part of
	 * @param {String} bridgeSettings.discord.channelId	ID of the Discord channel this bridge is part of
	 * @param {Boolean} bridgeSettings.discord.relayJoinLeaveMessages	Whether or not to relay join/leave messages from Discord to Telegram
	 */
	constructor(bridgeSettings) {
		/**
		 * Name of the bridge
		 *
		 * @type String
		 */
		this.name = bridgeSettings.name;

		/**
		 * Direction of the bridge
		 *
		 * @type String
		 */
		this.direction = bridgeSettings.direction;

		/**
		 * ID of the Telegram chat to bridge
		 *
		 * @type Integer
		 */
		this.telegramChatId = Number.parseInt(bridgeSettings.telegram.chatId);

		/**
		 * ID of the Discord channel to bridge
		 *
		 * @type String
		 */
		this.discordServerId = bridgeSettings.discord.serverId;

		/**
		 * ID of the Discord server the channel is on
		 *
		 * @type String
		 */
		this.discordChannelId = bridgeSettings.discord.channelId;

		/**
		 * Settings for the Telegram side of the bridge
		 *
		 * @type Object
		 */
		this.telegram = {
			chatId: this.telegramChatId,
			relayJoinLeaveMessages: bridgeSettings.telegram.relayJoinLeaveMessages
		};

		/**
		 * Settings for the Discord side of the bridge
		 *
		 * @type Object
		 */
		this.discord = {
			serverId: this.discordServerId,
			channelId: this.discordChannelId,
			relayJoinLeaveMessages: bridgeSettings.discord.relayJoinLeaveMessages
		};
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
