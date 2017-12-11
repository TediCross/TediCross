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
class BridgeMap {
	constructor(bridgeMap) {
		/**
		 * The map itself
		 *
		 * @private
		 */
		this._bridgeMap = new Map();

		this.map = bridgeMap;

		bridgeMap.forEach(map => {
			this._bridgeMap.set(`telegram-${map.telegram}`, map);
			this._bridgeMap.set(`discord-${map.discord.channel}`, map);
			this._bridgeMap.set(`discord-guild-${map.discord.guild}`, map);
		});
	}

    /**
     * Checks to see if a bridge exists for given id
     *
     * @param {String} type	Type of bridge (telegram, discord or discord-guild)
     * @param {String} id	Id of the chat/channel/guild
     *
     * @return {Boolean}    If the chat/channel/guild was found for given type
     */
	has(type, id) {
		return this._bridgeMap.has(`${type}-${id}`);
	}

    /**
     * Gets the bridge for given bridge type and id
     *
     * @param {String} type	Type of bridge (telegram, discord or discord-guild)
     * @param {String} id	Id of the chat/channel/guild
     *
     * @return {Object}    The bridge object
     */
    getBridge(type, id) {
		if (!this.has(type, id)) {
			throw new Error(`Could not find a entry for ${type} with id ${id}`);
		}

		return this._bridgeMap.get(`${type}-${id}`);
	}

    /**
     * Get the telegram chat id for given discord channel id
     *
     * @param {String} discordId	Id of the discord channel
     *
     * @return {Number}    The telegram chat id
     */
	getTelegramChat(discordId) {
		return Number(this.getBridge("discord", discordId).telegram);
	}

    /**
     * Get the discord channel id for given telegram chat id
     *
     * @param {String} telegramId	Id of the telegram chat
     *
     * @return {String}    The discord channel id
     */
	getDiscordChannel(telegramId) {
		return this.getBridge("telegram", telegramId).dicord.channel;
	}
}

/********************
 * Export the class *
 ********************/

module.exports = BridgeMap;
