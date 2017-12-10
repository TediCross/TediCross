"use strict";

/**************************
 * Import important stuff *
 **************************/
 const Application = require("./Application");

/********************
 * Create the class *
 ********************/

/**
 * Handles mapping of the chats to easily find the chat/channel connected
 *
 * @param {Array} List of chats
 */
class ChatMap {
	constructor(chatMap) {
		/**
		 * The map itself
		 *
		 * @private
		 */
		// this._discordMap = new Map();
		// this._telegramMap = new Map();
		this._chatMap = new Map();

		this.map = chatMap;

		chatMap.forEach(chat => {
			this._chatMap.set(`telegram-${chat.telegram}`, chat);
			this._chatMap.set(`discord-${chat.discord.channel}`, chat);
			this._chatMap.set(`discord-guild-${chat.discord.guild}`, chat);
		});
	}

	has(type, id) {
		return this._chatMap.has(`${type}-${id}`);
	}

	getChat(type, id) {
		if (!this.has(type, id)) {
			throw new Error(`Could not find a entry for ${type} with id ${id}`);
		}

		return this._chatMap.get(`${type}-${id}`);
	}

	getTelegramChat(discordId) {
		return this.getChat("discord", discordId).telegram;
	}

	getDiscordChannel(telegramId) {
		return this.getChat("telegram", telegramId).dicord.channel;
	}
}

/********************
 * Export the class *
 ********************/

module.exports = ChatMap;
