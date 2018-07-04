"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");

/*********************************
 * The relayOldMessages function *
 *********************************/

/**
 * Relays messages which have been sent in Discord since the bot was last shut down
 *
 * @param {Logger} logger	The Logger instance to log messages to
 * @param {discord.Client} dcBot	The discord bot to relay from
 * @param {LatestDiscordMessageIds} latestDiscordMessageIds	Map between the bridges and the last relayed message ID on them
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 *
 * @returns {Promise}	Promise which resolves when all messages have been relayed
 */
async function relayOldMessages(logger, dcBot, latestDiscordMessageIds, bridgeMap) {
	// Wait for the bot to connect to the API
	await dcBot.ready;

	const sortAndRelay = R.pipe(
		// Sort them by sending time
		R.sortBy(R.prop("createdTimestamp")),
		// Emit each message to let the bot logic handle them
		R.forEach(message => dcBot.emit("message", message))
	);

	// Find the latest message IDs for all bridges
	return bridgeMap.bridges.map((bridge) => ({
		bridge,
		messageId: latestDiscordMessageIds.getLatest(bridge)
	}))
		// Get messages which have arrived on each bridge since the bot was last shut down
		.map(async ({bridge, messageId}) => {
			try {
				const messages = await dcBot.channels.get(bridge.discord.channelId).fetchMessages({limit: 100, after: messageId});
				sortAndRelay(messages.array());
			} catch (err) {
				logger.error(err);
			}
		});
}

/*************
 * Export it *
 *************/

module.exports = relayOldMessages;
