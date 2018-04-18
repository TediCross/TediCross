"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const _ = require("lodash");

/*********************************
 * The relayOldMessages function *
 *********************************/

/**
 * Relays messages which have been sent in Discord since the bot was last shut down
 *
 * @param {discord.Client} dcBot	The discord bot to relay from
 * @param {LatestDiscordMessageIds} latestDiscordMessageIds	Map between the bridges and the last relayed message ID on them
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 *
 * @returns {Promise}	Promise which resolves when all messages have been relayed
 */
function relayOldMessages(dcBot, latestDiscordMessageIds, bridgeMap) {

	// Wait for the bot to connect to the API
	return dcBot.ready.then(() => {

		// Find the latest message IDs for all bridges
		return bridgeMap.bridges.map((bridge) => ({
			bridge,
			messageId: latestDiscordMessageIds.getLatest(bridge)
		}))
			// Get messages which have arrived on each bridge since the bot was last shut down
			.map(({bridge, messageId}) => {
				return dcBot.channels.get(bridge.discord.channelId).fetchMessages({limit: 100, after: messageId})
					.then((messages) => {
						_.chain(messages.array())
							// Sort them on sending time
							.sortBy((message) => message.createdTimestamp)
							// Emit each message to let the bot logic handle them
							.map((message) => dcBot.emit("message", message))
							// Make the lodash chain actually do its stuff
							.value();
					})
					.catch((err) => Application.logger.error(err));
			});
	});
}

/*************
 * Export it *
 *************/

module.exports = relayOldMessages;
