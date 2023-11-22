import { Client, ForumChannel, TextChannel } from "discord.js";

/**
 * Gets a Discord channel, and logs an error if it doesn't exist
 *
 * @returns	A Promise resolving to the channel, or rejecting if it could not be fetched for some reason
 */
// export const fetchDiscordChannel = R.curry((dcBot: Client, bridge) => {
export const fetchDiscordChannel = async (
	dcBot: Client,
	bridge: any,
	threadID?: number,
	topicName?: string,
	text?: string
) => {
	// Get the channel's ID
	let channelId = bridge.discord.channelId;

	if (bridge.topicBridges && threadID) {
		let topicFound = false;
		for (const topicBridge of bridge.topicBridges) {
			if (topicBridge.telegram === threadID) {
				channelId = topicBridge.discord;
				topicFound = true;
				break;
			}
		}

		// create new topic in discord
		if (!topicFound && bridge.topicBridgesAutoCreate) {
			// ignore empty messages
			if (!topicName || !text) {
				// console.error(`No topic name or Text: ${threadID} `);
				throw "No topic / No text";
			}

			try {
				const channel = await dcBot.channels.fetch(channelId);
				// if ((channel as any)?.isThreadOnly()) {
				const newTopicName = topicName || "bot-created-topic";
				const newThread = await (channel as unknown as ForumChannel).threads.create({
					name: newTopicName,
					message: {
						content: "Auto-Mapping for Telegram thread"
					},
					// autoArchiveDuration: 60,
					reason: "Auto-Mapping for Telegram thread"
				});

				const newTopic = { telegram: threadID, discord: newThread.id, name: newTopicName };
				bridge.topicBridges.push(newTopic);

				return newThread as unknown as TextChannel;
			} catch (err: any) {
				console.error(`Could not create Discord channel ${channelId} in bridge ${bridge.name}: ${err.message}`);
				throw err;
			}
		}
	}

	// Try to get the channel
	return dcBot.channels.fetch(channelId).catch((err: Error) => {
		console.error(`Could not find Discord channel ${channelId} in bridge ${bridge.name}: ${err.message}`);
		throw err;
	}) as unknown as Promise<TextChannel>;
};
