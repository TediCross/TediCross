"use strict";

/**************************
 * Import important stuff *
 **************************/

const handleEntities = require("./handleEntities");

/***********
 * Helpers *
 ***********/
 
/**
 * Gets the display name of a user
 *
 * @param {Object} user	A user object
 * @param {Object} chat	A chat object
 * @param {Boolean} useFirstNameInsteadOfUsername	Whether or not to use the user's first name instead of username
 *
 * @return {String}	The user's display name
 *
 * @private
 */
function getDisplayName(user, chat, useFirstNameInsteadOfUsername) {
	return chat.type === "channel"
		? getDisplayNameFromChannel(chat)
		: getDisplayNameFromUser(user, useFirstNameInsteadOfUsername)
	;
}

/**
 * Makes a display name from a channel's chat object
 *
 * @param {Object} chat	The chat object
 *
 * @returns {String}	The channel's display name
 */
function getDisplayNameFromChannel(chat) {
	return chat.title;
}

/**
 * @param {Object} user	A user object
 * @param {Boolean} useFirstNameInsteadOfUsername	Whether or not to use the user's first name instead of username
 *
 * @returns {String}	The display name of the user
 */
function getDisplayNameFromUser(user, useFirstNameInsteadOfUsername) {
	// Extract the username
	let displayName = user.username;

	// Check whether or not to use names instead (or if the username does not exist)
	if (!displayName || useFirstNameInsteadOfUsername) {
		displayName = user.first_name;
	}

	return displayName;
}

/*********************************
 * The messageConverter function *
 *********************************/

/**
 * Converts Telegram messages to appropriate from and text
 *
 * @param {Message} message	The Telegram message to convert
 * @param {DiscordUserMap} dcUsers	A map between discord users and their IDs
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {Settings} settings	The settings to use
 *
 * @return {Object} A object containing message information as from, text etc
 */
function messageConverter(message, dcUsers, tgBot, settings) {
	// Convert the text to Discord format
	let text = handleEntities(dcUsers, message.text, message.entities);

	// Find out who the message is from
	let fromName = getDisplayName(message.from, message.chat, settings.telegram.useFirstNameInsteadOfUsername);

	// Check if it is a reply
	if (message.reply_to_message !== undefined) {

		// Get the name of the user this is a reply to
		let inReplyTo = getDisplayName(message.reply_to_message.from, message.chat, settings.telegram.useFirstNameInsteadOfUsername);

		// Is this a reply to the bot, i.e. to a Discord user?
		if (message.reply_to_message.from !== undefined && message.reply_to_message.from.id === tgBot.me.id) {
			// Get the name of the Discord user this is a reply to
			const dcUsername = message.reply_to_message.text.split("\n")[0];
			inReplyTo = dcUsers.lookupUsername(dcUsername) ? `<@${dcUsers.lookupUsername(dcUsername)}>` : dcUsername;
		}

		// Add a part of the replied-to-message as an embed
		if (message.reply_to_message.text !== undefined) {
			let repliedToText = message.reply_to_message.text;

			// Is this a reply to the bot, i.e. to a Discord user?
			if (message.reply_to_message.from !== undefined && message.reply_to_message.from.id === tgBot.me.id) {
				[ , ...repliedToText] = message.reply_to_message.text.split("\n");
				repliedToText = repliedToText.join("\n");
			}

			// Take only the first 20 characters
			repliedToText = repliedToText.length > 20
				? repliedToText.slice(0, 20) + "…"
				: repliedToText
			;

			// Compensate for multiline messages
			repliedToText = repliedToText.replace(/\n/g, "\n  > ");

			// Add it to the text
			text = "  > " + repliedToText + "\n" + text;
		}

		// Add it to the 'from' text
		fromName = `${fromName} (in reply to ${inReplyTo})`;
	}

	// Check if it is a forwarded message
	const forward_from = message.forward_from || message.forward_from_chat;
	if (forward_from !== undefined) {
		// Find the name of the user this was forwarded from
		const forwardFrom = getDisplayName(forward_from, forward_from, settings.telegram.useFirstNameInsteadOfUsername);

		// Add it to the 'from' text
		fromName = `${forwardFrom} (forwarded by ${fromName})`;
	}

	return {
		text,
		from: fromName,
		composed: `**${fromName}**\n${text}`
	};
}

/***********************
 * Export the function *
 ***********************/

module.exports = messageConverter;
