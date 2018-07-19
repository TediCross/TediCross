"use strict";

/**************************
 * Import important stuff *
 **************************/

const handleEntities = require("./handleEntities");

/*********************
 * Make some helpers *
 *********************/

/**
 * Creates a 'from' object from a channel
 *
 * @param {Object} chat	The chat object of the channel
 *
 * @returns {Object}	An object on the form {type, title} where 'type' is "channel"
 *
 * @private
 */
function channelFrom(chat) {
	return {
		type: "channel",
		title: chat.title
	};
}

/**
 * Creates a 'from' object from a user
 *
 * @param {Object} user	The user's user object
 *
 * @returns {Object}	An object on the form {type, firstName, lastName, username} where 'type' is "user"
 *
 * @private
 */
function userFrom(user) {
	return {
		type: "user",
		firstName: user.first_name,
		lastName: user.last_name,
		username: user.username
	};
}

/**
 * Processes a reply
 *
 * @param {Object} reply	The reply to process
 *
 * @returns {Object}	The processed reply
 *
 * @private
 */
function processReply(reply, tgBot) {
	const processed = processMessage(reply);

	// If the reply was to the bot, it was really to the Discord user
	if (processed.from.username === tgBot.me.username) {
		// Extract the Discord user's name from the message and update the 'from' object
		const usernameMatch = /^\*\*([^*]+)\*\*/.exec(processed.text);
		if (usernameMatch !== undefined) {
			processed.from = userFrom({
				first_name: usernameMatch[1],
				last_name: undefined,
				username: usernameMatch[1]
			});
		}
	}
	return processed;
}

/************************
 * The processor itself *
 ************************/

/**
 * Processes a message into a more handleable internal TediCross format
 *
 * @param {Object} message	A raw message object from Telegram. Either from 'update.message', 'update.channel_post', 'update.edited_message' or 'message.edited_channel_post'
 * @param {Bridge} bridge	The bridge this message is on
 * @param {Discord} dcBot	The discord bot
 * @param {BotAPI} tgBot	The telegram bot
 *
 * @returns {ProcessedMessage}	The processed message
 */
function processMessage(message, bridge, dcBot, tgBot) {
	return {
		from: message.chat.type === "channel"
			? channelFrom(message.chat)
			: userFrom(message.from)
		,
		reply: message.reply_to_message !== undefined
			? processReply(message.reply_to_message, tgBot)
			: null
		,
		forward: message.forward_from !== undefined
			? userFrom(message.forward_from)
			: message.forward_from_chat !== undefined
				? channelFrom(message.forward_from_chat)
				: null
		,
		text: message.text !== undefined
			? handleEntities(message.text, message.entities, dcBot, bridge)
			: undefined
	};
}

/*************
 * Export it *
 *************/

module.exports = processMessage;
