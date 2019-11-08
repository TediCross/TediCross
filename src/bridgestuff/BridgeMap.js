"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");

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
		 * @type {Bridge[]}
		 */
		this.bridges = [...bridges];

		/**
		 * Map between Discord channel IDs and bridges
		 *
		 * @type {Map}
		 *
		 * @private
		 */
		this._discordToBridge = new Map();

		/**
		 * Map between Telegram chat IDs and bridges
		 *
		 * @type {Map}
		 *
		 * @private
		 */
		this._telegramToBridge = new Map();

		// Populate the maps and set
		bridges.forEach((bridge) => {
			const d = this._discordToBridge.get(bridge.discord.channelId) || [];
			const t = this._telegramToBridge.get(bridge.telegram.chatId) || [];
			this._discordToBridge.set(bridge.discord.channelId, [...d, bridge]);
			this._telegramToBridge.set(bridge.telegram.chatId, [...t, bridge]);
		});
	}

	/**
	 * Gets a bridge from Telegram chat ID
	 *
	 * @param {Integer} telegramChatId	ID of the Telegram chat to get the bridge for
	 *
	 * @returns {Bridge[]}	The bridges corresponding to the chat ID
	 */
	fromTelegramChatId(telegramChatId) {
		return R.defaultTo([], this._telegramToBridge.get(telegramChatId));
	}

	/**
	 * Gets a bridge from Discord channel ID
	 *
	 * @param {Integer} discordChannelId	ID of the Discord channel to get the bridge for
	 *
	 * @returns {Bridges[]}	The bridges corresponding to the channel ID
	 */
	fromDiscordChannelId(discordChannelId) {
		return R.defaultTo([], this._discordToBridge.get(discordChannelId));
	}
}

/*************
 * Export it *
 *************/

module.exports = BridgeMap;
