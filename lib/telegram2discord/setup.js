"use strict";

/**************************
 * Import important stuff *
 **************************/

const messageConverter = require("./messageConverter");
const MessageMap = require("../MessageMap");
const R = require("ramda");
const middlewares = require("./middlewares");
const From = require("./From");
const handleEntities = require("./handleEntities");
const Discord = require("discord.js");

/***********
 * Helpers *
 ***********/

/**
 * Clears old messages on a tgBot, making sure there are no updates in the queue
 *
 * @param {Telegraf} tgBot	The Telegram bot to clear messages on
 *
 * @returns {Promise}	Promise resolving to nothing when the clearing is done
 */
function clearOldMessages(tgBot, offset = -1) {
	const timeout = 0;
	const limit = 100;
	return tgBot.telegram.getUpdates(timeout, limit, offset)
		.then(R.ifElse(
			R.isEmpty,
			R.always(undefined),
			R.compose(
				newOffset => clearOldMessages(tgBot, newOffset),
				R.add(1),
				R.prop("update_id"),
				R.last
			)
		));
}

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

/**
 * Makes a name object (for lack of better term) of a user object. It contains the user's full name, and the username or the text `No username`
 *
 * @param {User} user	The user object to make the name object of
 *
 * @returns {Object}	The name object, with `name` and `username` as properties
 */
function makeNameObject(user) {
	// Make the user's full name
	const name = user.first_name
		+ (user.last_name !== undefined
			? " " + user.last_name
			: ""
		);

	// Make the user's username
	const username = user.username !== undefined
		? "@" + user.username
		: "No username";

	return {
		name,
		username
	};
}

/**
 * Curryed function making middleware be handled for every bridge
 *
 * @param {Function} func	The message handler to wrap
 * @param {Context} ctx	The Telegram message triggering the wrapped function, wrapped in a context
 *
 * @private
 */
const createMessageHandler = R.curry((func, ctx) => {
	// Wait for the Discord bot to become ready
	ctx.TediCross.dcBot.ready.then(() =>
		ctx.tediCross.bridges.forEach((bridge) => func(ctx, bridge))
	);
});

/**********************
 * The setup function *
 **********************/

/**
 * Sets up the receiving of Telegram messages, and relaying them to Discord
 *
 * @param {Logger} logger	The Logger instance to log messages to
 * @param {Telegraf} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 * @param {MessageMap} messageMap	Map between IDs of messages
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 * @param {Settings} settings	The settings to use
 */
function setup(logger, tgBot, dcBot, messageMap, bridgeMap, settings) {
	tgBot.ready = Promise.all([
		// Get info about the bot
		tgBot.telegram.getMe(),
		// Clear old messages, if wanted
		settings.telegram.skipOldMessages ? clearOldMessages(tgBot) : Promise.resolve()
	])
		.then(([me]) => {
			// Log the bot's info
			logger.info(`Telegram: ${me.username} (${me.id})`);

			// Add some global context
			tgBot.context.TediCross = {
				me,
				bridgeMap,
				dcBot,
				settings
			};

			// Apply middlewares
			tgBot.use(middlewares.addTediCrossObj);
			tgBot.use(middlewares.addMessageObj);
			tgBot.command("chatinfo", middlewares.chatinfo);
			tgBot.use(middlewares.addBridgesToContext);
			tgBot.use(middlewares.informThisIsPrivateBot);
			tgBot.use(middlewares.removeD2TBridges);
			tgBot.command(middlewares.removeBridgesIgnoringCommands);
			tgBot.on("new_chat_members", middlewares.removeBridgesIgnoringJoinMessages);
			tgBot.on("left_chat_member", middlewares.removeBridgesIgnoringLeaveMessages);
			tgBot.use(middlewares.addFromObj);
			tgBot.use(middlewares.addReplyObj);
			tgBot.use(middlewares.addForwardFrom);
			tgBot.use(middlewares.addTextObj);
			tgBot.use(middlewares.addFileObj);
			tgBot.use(middlewares.addFileStream);

tgBot.use((ctx, next) => {console.log(ctx.tediCross); next();});

/* Old */
			// Set up event listener for message edits
			const handleEdits = createMessageHandler(async (ctx, bridge) => {
				try {
					const tgMessage = ctx.tediCross.message;

					// Wait for the Discord bot to become ready
					await dcBot.ready;

					// Find the ID of this message on Discord
					const [dcMessageId] = messageMap.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, bridge, tgMessage.message_id);

					// Get the messages from Discord
					const dcMessage = await dcBot.channels.get(bridge.discord.channelId).fetchMessage(dcMessageId);

					const messageObj = messageConverter(ctx, tgBot, settings, dcBot, bridge);

					// Try to edit the message
					const textToSend = bridge.telegram.sendUsernames
						? `**${messageObj.from}**\n${messageObj.text}`
						: messageObj.text
					;
					await dcMessage.edit(textToSend);
				} catch (err) {
					// Log it
					logger.error(`[${bridge.name}] Could not edit Discord message:`, err);
				}
			});
			tgBot.on("edited_message", handleEdits);
			tgBot.on("edited_channel_post", handleEdits);

			// Listen for users joining the chat
			tgBot.on("new_chat_members", createMessageHandler((ctx, bridge) => {

				const new_chat_members = ctx.tediCross.message.new_chat_members;

				// Notify Discord about each user
				new_chat_members.forEach((user) => {
					// Make the text to send
					const nameObj = makeNameObject(user);
					const text = `**${nameObj.name} (${nameObj.username})** joined the Telegram side of the chat`;

					// Pass it on
					dcBot.ready.then(() => {
						return dcBot.channels.get(bridge.discord.channelId).send(text);
					})
						.catch((err) => logger.error(`[${bridge.name}] Could not notify Discord about a user that joined Telegram`, err));
				});
			}));

			// Listen for users leaving the chat
			tgBot.on("left_chat_member", createMessageHandler(async (ctx, bridge) => {

				const left_chat_member = ctx.tediCross.message.left_chat_member;

				// Make the text to send
				const nameObj = makeNameObject(left_chat_member);
				const text = `**${nameObj.name} (${nameObj.username})** left the Telegram side of the chat`;

				try {
					// Pass it on when Discord is ready
					await dcBot.ready;
					await dcBot.channels.get(bridge.discord.channelId).send(text);
				} catch (err) {
					logger.error(`[${bridge.name}] Could not notify Discord about a user that left Telegram`, err);
				}
			}));
/* /Old */

			// Prepare and send the message to Discord
			tgBot.use(createMessageHandler(async (ctx, bridge) => {
				// Get the channel to send to
				const channel = dcBot.channels.get(bridge.discord.channelId);

				// Shorthand for the tediCross context
				const tc = ctx.tediCross;

				// Make the header
				let header = R.ifElse(
					R.always(bridge.telegram.sendUsernames),
					tc => {
						// Get the name of the sender of this message
						const senderName = From.makeDisplayName(settings.telegram.useFirstNameInsteadOfUsername, tc.from);

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
							const origSender = From.makeDisplayName(settings.telegram.useFirstNameInsteadOfUsername, tc.forwardFrom);
							header = `**${origSender}** (forwarded by **${senderName}**)`;
						}
						return header;
					},
					R.always("")
				)(tc);

				try {
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
					await channel.send(R.head(chunks), attachment);
					const dcMessage = await R.reduce((p, chunk) => p.then(() => channel.send(chunk)), Promise.resolve());

					// Make the mapping so future edits can work XXX Only the last chunk is considered
					messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, bridge, tc.message.message_id, dcMessage.id);
				} catch (err) {
					logger.error(`[${bridge.name}] Discord did not accept a text message:`, err);
				}
			}));
		})
		// Start getting updates
		.then(() => tgBot.startPolling());
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
