"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const From = require("./From");
const MessageMap = require("../MessageMap");
const { sleepOneMinute } = require("../sleep");
const helpers = require("./helpers");
const fetchDiscordChannel = require("../fetchDiscordChannel");

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
	ctx.TediCross.dcBot.ready.then(() => R.forEach(bridge => func(ctx, bridge))(ctx.tediCross.bridges));
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
		.then(message =>
			Promise.all([
				// Delete the info
				helpers.deleteMessage(ctx, message),
				// Delete the command
				ctx.deleteMessage()
			])
		)
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
		const text = `**${from.firstName} (${R.defaultTo(
			"No username",
			from.username
		)})** joined the Telegram side of the chat`;

		// Pass it on
		ctx.TediCross.dcBot.ready
			.then(() =>
				fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then(channel => channel.send(text))
			)
			.catch(err =>
				console.error(
					`Could not tell Discord about a new chat member on bridge ${bridge.name}: ${err.message}`
				)
			);
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
	const text = `**${from.firstName} (${R.defaultTo(
		"No username",
		from.username
	)})** left the Telegram side of the chat`;

	// Pass it on
	ctx.TediCross.dcBot.ready
		.then(() => fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then(channel => channel.send(text)))
		.catch(err =>
			console.error(
				`Could not tell Discord about a chat member who left on bridge ${bridge.name}: ${err.message}`
			)
		);
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
		try {
			// Discord doesn't handle messages longer than 2000 characters. Split it up into chunks that big
			const messageText = prepared.header + "\n" + prepared.text;
			let chunks = R.splitEvery(2000, messageText);

			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Get the channel to send to
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, prepared.bridge);

			let dcMessage = null;
			// Send the attachment first, if there is one
			if (!R.isNil(prepared.file)) {
				try {
					dcMessage = await channel.send(R.head(chunks), prepared.file);
					chunks = R.tail(chunks);
				} catch (err) {
					if (err.message === "Request entity too large") {
						dcMessage = await channel.send(
							`***${prepared.senderName}** on Telegram sent a file, but it was too large for Discord. If you want it, ask them to send it some other way*`
						);
					} else {
						throw err;
					}
				}
			}
			// Send the rest in serial
			dcMessage = await R.reduce(
				(p, chunk) => p.then(() => channel.send(chunk)),
				Promise.resolve(dcMessage),
				chunks
			);

			// Make the mapping so future edits can work XXX Only the last chunk is considered
			ctx.TediCross.messageMap.insert(
				MessageMap.TELEGRAM_TO_DISCORD,
				prepared.bridge,
				ctx.tediCross.messageId,
				dcMessage.id
			);
		} catch (err) {
			console.error(
				`Could not relay a message to Discord on bridge ${prepared.bridge.name}: ${err.message}`
			);
		}
	})(ctx.tediCross.prepared);

/**
 * Handles message edits
 *
 * @param {Object} ctx	The Telegraf context
 *
 * @returns {undefined}
 */
const handleEdits = createMessageHandler(async (ctx, bridge) => {
	// Function to "delete" a message on Discord
	const del = async (ctx, bridge) => {
		try {
			// Find the ID of this message on Discord
			const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				ctx.tediCross.message.message_id
			);

			// Get the channel to delete on
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge);

			// Delete it on Discord
			const dp = channel.bulkDelete([dcMessageId]);

			// Delete it on Telegram
			const tp = ctx.deleteMessage();

			await Promise.all([dp, tp]);
		} catch (err) {
			console.error(
				`Could not cross-delete message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`
			);
		}
	};

	// Function to edit a message on Discord
	const edit = async (ctx, bridge) => {
		try {
			const tgMessage = ctx.tediCross.message;

			// Find the ID of this message on Discord
			const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				tgMessage.message_id
			);

			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Get the messages from Discord
			const dcMessage = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then(channel =>
				channel.messages.fetch(dcMessageId)
			);

			R.forEach(async prepared => {
				// Discord doesn't handle messages longer than 2000 characters. Take only the first 2000
				const messageText = R.slice(0, 2000, prepared.header + "\n" + prepared.text);

				// Send them in serial, with the attachment first, if there is one
				await dcMessage.edit(messageText, { attachment: prepared.attachment });
			})(ctx.tediCross.prepared);
		} catch (err) {
			// Log it
			console.error(
				`Could not cross-edit message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`
			);
		}
	};

	// Check if this is a "delete", meaning it has been edited to a single dot
	if (
		bridge.telegram.crossDeleteOnDiscord &&
		ctx.tediCross.text.raw === "." &&
		R.isEmpty(ctx.tediCross.text.entities)
	) {
		await del(ctx, bridge);
	} else {
		await edit(ctx, bridge);
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
