"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const From = require("./From");
const MessageMap = require("../MessageMap");
const { sleepOneMinute } = require("../sleep");
const helpers = require("./helpers");

/***********
 * Helpers *
 ***********/

/**
 * Makes an endware function be handled by all bridges it applies to. Curried
 *
 * @param {Function} func	The message handler to wrap
 * @param {Context} ctx	The Telegraf context
 *
 * @returns {undefined}
 *
 * @private
 */
const createMessageHandler = R.curry((func, ctx) => {
	// Wait for the Discord bot to become ready
	ctx.TediCross.dcBot.ready.then(() =>
		R.forEach(bridge => func(ctx, bridge))(ctx.tediCross.bridges)
	);
});

/*************************
 * The endware functions *
 *************************/

/**
 * Replies to a message with info about the chat
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Object} ctx.tediCross.message	The message to reply to
 * @param {Object} ctx.tediCross.message.chat	The object of the chat the message is from
 * @param {Integer} ctx.tediCross.message.chat.id	ID of the chat the message is from
 *
 * @returns {undefined}
 */
const chatinfo = ctx => {
	// Reply with the info
	ctx.reply(`chatID: ${ctx.tediCross.message.chat.id}`)
		// Wait some time
		.then(sleepOneMinute)
		// Delete the info and the command
		.then(message => Promise.all([
			// Delete the info
			helpers.deleteMessage(ctx, message),
			// Delete the command
			ctx.deleteMessage()
		]))
		.catch(helpers.ignoreAlreadyDeletedError);
};

/**
 * Handles users joining chats
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross.message	The Telegram message received
 * @param {Object} ctx.tediCross.message	The Telegram message received
 * @param {Object} ctx.tediCross.message.new_chat_members	List of the users who joined the chat
 * @param {Object} ctx.TediCross	The global TediCross context of the message
 *
 * @returns {undefined}
 */
const newChatMembers = createMessageHandler((ctx, bridge) =>
	// Notify Discord about each user
	R.forEach(user => {
		// Make the text to send
		const from = From.createFromObjFromUser(user);
		const text = `**${from.firstName} (${R.defaultTo("No username", from.username)})** joined the Telegram side of the chat`;

		// Pass it on
		helpers.getDiscordChannel(ctx, bridge)
			.send(text);
	})(ctx.tediCross.message.new_chat_members)
);

/**
 * Handles users leaving chats
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross	The TediCross context of the message
 * @param {Object} ctx.tediCross.message	The Telegram message received
 * @param {Object} ctx.tediCross.message.left_chat_member	The user object of the user who left
 * @param {Object} ctx.TediCross	The global TediCross context of the message
 *
 * @returns {undefined}
 */
const leftChatMember = createMessageHandler((ctx, bridge) => {
	// Make the text to send
	const from = From.createFromObjFromUser(ctx.tediCross.message.left_chat_member);
	const text = `**${from.firstName} (${R.defaultTo("No username", from.username)})** left the Telegram side of the chat`;

	// Pass it on
	helpers.getDiscordChannel(ctx, bridge)
		.send(text);
});

/**
 * Relays a message from Telegram to Discord
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross	The TediCross context of the message
 * @param {Object} ctx.TediCross	The global TediCross context of the message
 *
 * @returns {undefined}
 */
const relayMessage = ctx =>
	R.forEach(async prepared => {
		// Get the channel to send to
		const channel = helpers.getDiscordChannel(ctx, prepared.bridge);

		// Discord doesn't handle messages longer than 2000 characters. Split it up into chunks that big
		const messageText = prepared.header + "\n" + prepared.text;
		const chunks = R.splitEvery(2000, messageText);

		// Send them in serial, with the attachment first, if there is one
		let dcMessage = await channel.send(R.head(chunks), { file: prepared.file });
		if (R.length(chunks) > 1) {
			dcMessage = await R.reduce((p, chunk) => p.then(() => channel.send(chunk)), Promise.resolve(), R.tail(chunks));
		}

		// Make the mapping so future edits can work XXX Only the last chunk is considered
		ctx.TediCross.messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, prepared.bridge, ctx.tediCross.messageId, dcMessage.id);
	})(ctx.tediCross.prepared);

/**
 * Handles message edits
 *
 * @param {Object} ctx	The Telegraf context
 *
 * @returns {undefined}
 */
const handleEdits = createMessageHandler(async (ctx, bridge) => {
	try {
		const tgMessage = ctx.tediCross.message;

		// Find the ID of this message on Discord
		const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, bridge, tgMessage.message_id);

		// Get the messages from Discord
		const dcMessage = await helpers.getDiscordChannel(ctx, bridge)
			.fetchMessage(dcMessageId);

		R.forEach(async prepared => {
			// Discord doesn't handle messages longer than 2000 characters. Take only the first 2000
			const messageText = R.slice(0, 2000, prepared.header + "\n" + prepared.text);

			// Send them in serial, with the attachment first, if there is one
			await dcMessage.edit(messageText, { attachment: prepared.attachment });
		})(ctx.tediCross.prepared);
	} catch (err) {
		// Log it
		ctx.TediCross.logger.error(`[${bridge.name}] Could not edit Discord message:`, err);
	}
});

/***************
 * Export them *
 ***************/

module.exports = {
	chatinfo,
	newChatMembers,
	leftChatMember,
	relayMessage,
	handleEdits
};
