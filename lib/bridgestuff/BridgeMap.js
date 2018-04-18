"use strict";

/**************************
 * Import important stuff *
 **************************/

// eslint-disable-next-line no-unused-vars
const Bridge = require("./Bridge");

/***********************
 * The BridgeMap class *
 ***********************/

/**
 * Map between chat IDs and bridges
 */
class BridgeMap {
	/**
	 * Creates a new bridge map
	 *
	 * @param {Bridge[]} bridges	The bridges to map
	 */
	constructor(bridges) {
		/**
		 * List of all bridges
		 *
		 * @type Bridge[]
		 */
		this.bridges = [...bridges];

		/**
		 * Map between Discord channel IDs and bridges
		 *
		 * @type Map
		 *
		 * @private
		 */
		this._discordToBridge = new Map();

		/**
		 * Map between Telegram chat IDs and bridges
		 *
		 * @type Map
		 *
		 * @private
		 */
		this._telegramToBridge = new Map();

		/**
		 * Set of Discord servers which are bridged
		 *
		 * @type Set
		 *
		 * @private
		 */
		this._discordServers = new Set();

		// Populate the maps and set
		bridges.forEach((bridge) => {
			this._discordToBridge.set(bridge.discord.channelId, bridge);
			this._telegramToBridge.set(bridge.telegram.chatId, bridge);
			this._discordServers.add(bridge.discord.serverId);
		});
	}

	/**
	 * Gets a bridge from Telegram chat ID
	 *
	 * @param {Integer} telegramChatId	ID of the Telegram chat to get the bridge for
	 *
	 * @returns {Bridge}	The bridge corresponding to the chat ID
	 */
	fromTelegramChatId(telegramChatId) {
		return this._telegramToBridge.get(telegramChatId);
	}

	/**
	 * Gets a bridge from Discord channel ID
	 *
	 * @param {Integer} discordChannelId	ID of the Discord channel to get the bridge for
	 *
	 * @returns {Bridge}	The bridge corresponding to the channel ID
	 */
	fromDiscordChannelId(discordChannelId) {
		return this._discordToBridge.get(discordChannelId);
	}

	/**
	 * Checks if a Discord server ID is known
	 *
	 * @param {String} discordServerId	Discord server ID to check
	 *
	 * @returns {Boolean}	True if the server is known, false otherwise
	 */
	knownDiscordServer(discordServerId) {
		return this._discordServers.has(discordServerId);
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeMap;
