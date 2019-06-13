"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const From = require("./From");
const handleEntities = require("./handleEntities");
const Discord = require("discord.js");
const MessageMap = require("../MessageMap");
const messageConverter = require("./messageConverter");

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

/**
 * Makes the reply text to show on Discord
 *
 * @param {Object} replyTo	The replyTo object from the tediCross context
 * @param {Integer} replyLength	How many characters to take from the original
 * @param {Integer} maxReplyLines	How many lines to cut the reply text after
 *
 * @returns {String}	The reply text to display
 */
function makeReplyText(replyTo, replyLength, maxReplyLines) {
	// Make the reply string
	return R.compose(
		// Add ellipsis if the text was cut
		R.ifElse(
			R.compose(
				R.equals(R.length(replyTo.text.raw)),
				R.length
			),
			R.identity,
			R.concat(R.__, "…")
		),
		// Take only a number of lines
		R.join("\n"),
		R.slice(0, maxReplyLines),
		R.split("\n"),
		// Take only a portion of the text
		R.slice(0, replyLength),
	)(replyTo.text.raw);
}

/**
 * Makes a discord mention out of a username
 *
 * @param {String} username	The username to make the mention from
 * @param {Discord.Client} dcBot	The Discord bot to look up the user's ID with
 * @param {String} channelId	ID of the Discord channel to look up the username in
 *
 * @returns {String}	A Discord mention of the user
 */
function makeDiscordMention(username, dcBot, channelId) {
	// Get the name of the Discord user this is a reply to
	const dcUser = dcBot.channels.get(channelId).members.find(R.propEq("displayName", username));

	return R.ifElse(
		R.isNil,
		R.always(username),
		dcUser => `<@${dcUser.id}>`
	)(dcUser);
}

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
function chatinfo(ctx) {
	ctx.reply(`chatID: ${ctx.tediCross.message.chat.id}`);
}

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
		ctx.TediCross.dcBot.channels.get(bridge.discord.channelId)
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
	ctx.TediCross.dcBot.channels.get(bridge.discord.channelId)
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
const relayMessage = createMessageHandler(async (ctx, bridge) => {
	// Get the channel to send to
	const channel = ctx.TediCross.dcBot.channels.get(bridge.discord.channelId);

	// Shorthand for the tediCross context
	const tc = ctx.tediCross;

	// Make the header
	let header = R.ifElse(
		R.always(bridge.telegram.sendUsernames),
		tc => {
			// Get the name of the sender of this message
			const senderName = From.makeDisplayName(ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername, tc.from);

			// Make the default header
			let header = `**${senderName}**`;

			if (!R.isNil(tc.replyTo)) {
				// Add reply info to the header
				const repliedToName = R.ifElse(
					R.prop("isReplyToTediCross"),
					R.compose(
						username => makeDiscordMention(username, ctx.TediCross.dcBot, bridge.discord.channelId),
						R.prop("dcUsername")
					),
					R.compose(
						R.partial(From.makeDisplayName, [ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername]),
						R.prop("originalFrom")
					)
				)(tc.replyTo);


				header = `**${senderName}** (in reply to **${repliedToName}**`;

				if (ctx.TediCross.settings.discord.displayTelegramReplies === "inline") {
					// Make the reply text
					const replyText = makeReplyText(tc.replyTo, ctx.TediCross.settings.discord.replyLength, ctx.TediCross.settings.discord.maxReplyLines);

					// Put the reply text in the header, replacing newlines with spaces
					header = `${header}: _${R.replace(/\n/g, " ", replyText)}_)`;
				} else {
					// Append the closing parenthesis
					header = `${header})`;
				}
			} else if (!R.isNil(tc.forwardFrom)) {
				// Handle forwards
				const origSender = From.makeDisplayName(ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername, tc.forwardFrom);
				header = `**${origSender}** (forwarded by **${senderName}**)`;
			}
			return header;
		},
		R.always("")
	)(tc);

	// Handle embed replies
	if (!R.isNil(tc.replyTo) && ctx.TediCross.settings.discord.displayTelegramReplies === "embed") {
		// Make the text
		const replyText = handleEntities(tc.replyTo.text.raw, tc.replyTo.text.entities, ctx.TediCross.dcBot, bridge);

		const embed = new Discord.RichEmbed({
			// Discord will not accept embeds with more than 2048 characters
			description: R.slice(0, 2048, replyText)
		});

		await channel.send(header, { embed });

		// Reset the header so it's not sent again
		header = "";
	}

	// Handle file
	const attachment = !R.isNil(tc.file) ? new Discord.Attachment(tc.file.stream, tc.file.name) : null;

	// Make the text to send
	const text = handleEntities(tc.text.raw, tc.text.entities, ctx.TediCross.dcBot, bridge);

	// Discord doesn't handle messages longer than 2000 characters. Split it up into chunks that big
	const messageText = header + "\n" + text;
	const chunks = R.splitEvery(2000, messageText);

	// Send them in serial, with the attachment first, if there is one
	let dcMessage = await channel.send(R.head(chunks), attachment);
	if (R.length(chunks) > 1) {
		dcMessage = await R.reduce((p, chunk) => p.then(() => channel.send(chunk)), Promise.resolve(), R.tail(chunks));
	}

	// Make the mapping so future edits can work XXX Only the last chunk is considered
	ctx.TediCross.messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, bridge, tc.message.message_id, dcMessage.id);
});

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
		const dcMessage = await ctx.TediCross.dcBot.channels
			.get(bridge.discord.channelId)
			.fetchMessage(dcMessageId);

		const messageObj = messageConverter(ctx, bridge);

		// Try to edit the message
		const textToSend = bridge.telegram.sendUsernames
			? `**${messageObj.from}**\n${messageObj.text}`
			: messageObj.text
		;
		await dcMessage.edit(textToSend);
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
