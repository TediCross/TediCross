import { Client, Message } from "discord.js";
import R from "ramda";
import { BridgeMap } from "../bridgestuff/BridgeMap";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Logger } from "../Logger";
import { LatestDiscordMessageIds } from "./LatestDiscordMessageIds";

/*********************************
 * The relayOldMessages function *
 *********************************/

/**
 * Relays messages which have been sent in Discord since the bot was last shut down
 *
 * @param logger	The Logger instance to log messages to
 * @param dcBot	The discord bot to relay from
 * @param latestDiscordMessageIds	Map between the bridges and the last relayed message ID on them
 * @param bridgeMap	Map of the bridges to use
 *
 * @returns	Promise which resolves when all messages have been relayed
 */
export async function relayOldMessages(
	logger: Logger,
	dcBot: Client,
	latestDiscordMessageIds: LatestDiscordMessageIds,
	bridgeMap: BridgeMap
) {
	// Wait for the bot to connect to the API
	//@ts-ignore
	await dcBot.ready;

	const sortAndRelay = R.pipe(
		// Sort them by sending time
		R.sortBy<Message>(R.prop("createdTimestamp")),
		// Emit each message to let the bot logic handle them
		R.forEach((message: Message) => dcBot.emit("message", message))
	);

	// Find the latest message IDs for all bridges
	return (
		Promise.all(
			bridgeMap.bridges
				.map(bridge => ({
					bridge,
					messageId: latestDiscordMessageIds.getLatest(bridge)
				}))
				// Get messages which have arrived on each bridge since the bot was last shut down
				.map(({ bridge, messageId }) =>
					// Get the bridge's discord channel
					fetchDiscordChannel(dcBot, bridge)
						.then(channel =>
							// Check if the message exists. If it doesn't exist, and this is not checked, the following `fetch` will get every single message the channel has ever seen, spamming down Telegram
							channel.messages
								.fetch(messageId)
								// Fetch all messages after it
								.then(message =>
									channel.messages.fetch({
										limit: 100,
										after: message.id
									})
								)
								.then(messages => sortAndRelay([...messages.values()]))
						)
						.catch(err => {
							logger.error(
								`Could not fetch old messages for channel ${bridge.discord.channelId} in bridge ${bridge.name}: ${err.message}`
							);
						})
				)
		)
			// Always resolve to nothing
			.finally(R.always(undefined))
	);
}
