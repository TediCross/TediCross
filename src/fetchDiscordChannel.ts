import { Client, TextChannel } from "discord.js";

/**
 * Gets a Discord channel, and logs an error if it doesn't exist
 *
 * @returns	A Promise resolving to the channel, or rejecting if it could not be fetched for some reason
 */
// export const fetchDiscordChannel = R.curry((dcBot: Client, bridge) => {
export const fetchDiscordChannel = (dcBot: Client, bridge: any, threadID?: number) => {
	// Get the channel's ID
	let channelId = bridge.discord.channelId;

	if (bridge.topicBridges && threadID) {
		for (const topicBridges of bridge.topicBridges) {
			if (topicBridges.telegram === threadID) {
				channelId = topicBridges.discord;
				break;
			}
		}
	}

	// Try to get the channel
	return dcBot.channels.fetch(channelId).catch((err: Error) => {
		console.error(`Could not find Discord channel ${channelId} in bridge ${bridge.name}: ${err.message}`);
		throw err;
	}) as unknown as Promise<TextChannel>;
};
