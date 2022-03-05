import { Client, TextChannel } from "discord.js";
import R from "ramda";

/**
 * Gets a Discord channel, and logs an error if it doesn't exist
 *
 * @returns	A Promise resolving to the channel, or rejecting if it could not be fetched for some reason
 */
export const fetchDiscordChannel = R.curry((dcBot: Client, bridge) => {
	// Get the channel's ID
	const channelId = bridge.discord.channelId;

	// Try to get the channel
	return dcBot.channels.fetch(channelId).catch((err: Error) => {
		console.error(`Could not find Discord channel ${channelId} in bridge ${bridge.name}: ${err.message}`);
		throw err;
	}) as unknown as Promise<TextChannel>;
});

