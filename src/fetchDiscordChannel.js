"use strict";

const R = require("ramda");

/**
 * Gets a Discord channel, and logs an error if it doesn't exist
 *
 * @returns	A Promise resolving to the channel, or rejecting if it could not be fetched for some reason
 */
const fetchDiscordChannel = R.curry((dcBot, bridge) => {
	// Get the channel's ID
	const channelId = bridge.discord.channelId;

	// Try to get the channel
	return dcBot.channels.fetch(channelId).catch(err => {
		console.error(`Could not find Discord channel ${channelId} in bridge ${bridge.name}: ${err.message}`);
		throw err;
	});
});

module.exports = fetchDiscordChannel;
