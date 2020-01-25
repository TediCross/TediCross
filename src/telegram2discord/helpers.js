"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");

/********************
 * Make the helpers *
 ********************/

/**
 * Ignores errors arising from trying to delete an already deleted message. Rethrows other errors
 *
 * @param {Error} err	The error to check
 *
 * @returns {undefined}
 *
 * @throws {Error}	The error, if it is another type
 */
const ignoreAlreadyDeletedError = R.ifElse(
	R.propEq("description", "Bad Request: message to delete not found"),
	R.always(undefined),
	err => {throw err;}
);

/**
 * Deletes a Telegram message
 *
 * @param {Context} ctx	The Telegraf context to use
 * @param {Object} message	The message to delete
 *
 * @returns {Promise}	Promise resolving when the message is deleted
 */
const deleteMessage = R.curry((ctx, { chat, message_id }) => 
	ctx.telegram.deleteMessage(
		chat.id,
		message_id
	));

/**
 * Gets a Discord channel by ID from a Discord bot
 *
 * @param {Context} ctx	The Telegraf context to use
 * @param {Bridge} bridge	The bridge to get the channel for
 *
 * @returns {Discord.Channel}	The channel
 *
 * @throws {Error}	If the channel was not found
 */
const getDiscordChannel = R.curry((ctx, { name, discord: { channelId } }) => {
	// Get the channel
	const channel = ctx.TediCross.dcBot.channels.get(channelId);

	// Verify it exists
	if (R.isNil(channel)) {
		ctx.TediCross.logger.error(`[${name}] Could not get Discord channel with ID '${channelId}'. Please verify it is correct. Remember the quotes!`);
		throw new Error(`Could not find channel with ID '${channelId}'`);
	}

	// Return it
	return channel;
});

/***************
 * Export them *
 ***************/

module.exports = {
	ignoreAlreadyDeletedError,
	deleteMessage,
	getDiscordChannel
};
