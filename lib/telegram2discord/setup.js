"use strict";

/**************************
 * Import important stuff *
 **************************/

const messageConverter = require("./messageConverter");
const MessageMap = require("../MessageMap");
const R = require("ramda");
const mime = require("mime/lite");
const Bridge = require("../bridgestuff/Bridge");
const Discord = require("discord.js");
const request = require("request");
const middlewares = require("./middlewares");

/**
 * Creates a function which sends files from Telegram to discord
 *
 * @param {Telegraf} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 * @param {MessageMap} messageMap	Map between IDs of messages
 * @param {Settings} settings	The settings to use
 *
 * @returns {Function}	A function which can be used to send files from Telegram to Discord
 *
 * @private
 */
function makeFileSender(tgBot, dcBot, messageMap, settings) {
	/**
	 * Sends a file to Discord
	 *
	 * @param {String} arg.discordChannel Discord channel ID
	 * @param {Message} arg.message	The message the file comes from
	 * @param {String} arg.fileId	ID of the file to download from Telegram's servers
	 * @param {String} arg.fileName	Name of the file to send
	 * @param {String} [arg.caption]	Additional text to send with the file
	 * @param {Boolean} [arg.resolveExtension]	Set to true if the bot should try to find the file extension itself, in which case it will be appended to the file name. Defaults to false
	 */
	return async function (bridge, {message, fileId, fileName, caption = "", resolveExtension = false}) {
		// Make the text to send
		const messageObj = messageConverter(message, tgBot, settings, dcBot, bridge);
		const textToSend = bridge.telegram.sendUsernames
			? `**${messageObj.from}**:\n${caption}`
			: caption
		;

		// Wait for the Discord bot to become ready
		await dcBot.ready;

		// Start getting the file
		const [file, fileLink] = await Promise.all([
			tgBot.telegram.getFile(fileId),
			tgBot.telegram.getFileLink(fileId)
		]);
		const fileStream = request(fileLink);

		// Get the extension, if necessary
		const extension = resolveExtension
			? "." + file.file_path.split(".").pop()
			: ""
		;

		// Send it to Discord
		const dcMessage = await dcBot.channels.get(bridge.discord.channelId).send(
			textToSend,
			new Discord.Attachment(fileStream, fileName + extension)
		);

		messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, bridge, message.message_id, dcMessage.id);
	};
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
 * Curryed function creating handlers handling messages which should not be relayed, and passing through those which should
 *
 * @param {Logger} logger	The Logger instance to log messages to
 * @param {Telegraf} tgBot	The Telegram bot
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 * @param {Function} func	The message handler to wrap
 * @param {Context} ctx	The Telegram message triggering the wrapped function, wrapped in a context
 *
 * @private
 */
const createMessageHandler = R.curry((logger, tgBot, bridgeMap, settings, func, ctx) => {
	// Get the message object
	const message = ctx.tediCross.message;

	// Check if the message came from the correct chat
	ctx.tediCross.bridges.forEach((bridge) => {
		// Check if it is a command, and if commands should be ignored
		if (!R.isNil(message.text) && message.text.startsWith("/") && bridge.telegram.ignoreCommands) {
			return;
		}

		// Do the thing, if this is not a discord-to-telegram bridge
		if (bridge.direction !== Bridge.DIRECTION_DISCORD_TO_TELEGRAM) {
			func(message, bridge);
		}
	});
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
	// Put the bridges on the global tgBot context
	tgBot.context.bridgeMap = bridgeMap;

	// Apply middlewares
	tgBot.use(middlewares.addTediCrossObj);
	tgBot.use(middlewares.getMessageObj);
	tgBot.command("chatinfo", middlewares.chatinfo);
	tgBot.use(middlewares.addBridgesToContext);
	tgBot.use(middlewares.informThisIsPrivateBot);

	// Make the file sender
	const sendFile = makeFileSender(tgBot, dcBot, messageMap, settings);

	// Create the message handler wrapper
	const wrapFunction = createMessageHandler(logger, tgBot, bridgeMap, settings);

	// Set up event listener for text messages from Telegram
	tgBot.on("text", wrapFunction(async (message, bridge) => {

		// Turn the text discord friendly
		const messageObj = messageConverter(message, tgBot, settings, dcBot, bridge);

		try {
			// Pass it on to Discord when the dcBot is ready
			await dcBot.ready;

			// Get the channel to send to
			const channel = dcBot.channels.get(bridge.discord.channelId);

			// Make the header
			let header = bridge.telegram.sendUsernames ? `**${messageObj.from}**` : "";

			// Handle replies
			if (messageObj.reply !== null) {
				// Add the reply data to the header
				header = header + ` (In reply to **${messageObj.reply.author}**)`;

				// Figure out how to display the reply in Discord
				if (settings.discord.displayTelegramReplies === "embed") {
					// Make a Discord embed and send it first
					const embed = new Discord.RichEmbed({
						description: messageObj.reply.text
					});

					await channel.send(header, {embed});

					// Clear the header
					header = "";
				} else if (settings.discord.displayTelegramReplies === "inline") {
					// Just modify the header
					header = `${header.slice(0, -1)}: _${messageObj.reply.text}_)`;
				}
			}

			// Discord doesn't handle messages longer than 2000 characters. Split it up into chunks that big
			const messageText = header + "\n" + messageObj.text;
			const chunks = R.splitEvery(2000, messageText);

			// Send them in serial
			let dcMessage = null;
			for (const chunk of chunks) {
				dcMessage = await channel.send(chunk);
			}

			// Make the mapping so future edits can work XXX Only the last chunk is considered
			messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, bridge, message.message_id, dcMessage.id);
		} catch (err) {
			logger.error(`[${bridge.name}] Discord did not accept a text message:`, err);
			logger.error(`[${bridge.name}] Failed message:`, message.text);
		}
	}));

	// Set up event listener for photo messages from Telegram
	tgBot.on("photo", wrapFunction(async (message, bridge) => {
		try {
			await sendFile(bridge, {
				message,
				fileId: message.photo[message.photo.length-1].file_id,
				fileName: "photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
				caption: message.caption
			});
		} catch (err) {
			logger.error(`[${bridge.name}] Could not send photo`, err);
		}
	}));

	// Set up event listener for stickers from Telegram
	tgBot.on("sticker", wrapFunction(async (message, bridge) => {
		try {
			await sendFile(bridge, {
				message,
				fileId: message.sticker.thumb.file_id,
				fileName: "sticker.webp",	// Telegram will insist that it is a jpg, but it really is a webp
				caption: settings.telegram.sendEmojiWithStickers ? message.sticker.emoji : undefined
			});
		} catch (err) {
			logger.error(`[${bridge.name}] Could not send sticker`, err);
		}
	}));

	// Set up event listener for filetypes not caught by the other filetype handlers
	tgBot.on("document", wrapFunction(async (message, bridge) => {
		// message.file_name can for some reason be undefined some times.  Default to "file.ext"
		let fileName = message.document.file_name;
		if (fileName === undefined) {
			fileName = "file." + mime.getExtension(message.document.mime_type);
		}

		try {
			// Pass it on to Discord
			await sendFile(bridge, {
				message,
				fileId: message.document.file_id,
				fileName: fileName,
				resolveExtension: false
			});
		} catch (err) {
			logger.error(`[${bridge.name}] Could not send document`, err);
		}
	}));

	// Set up event listener for voice messages
	tgBot.on("voice", wrapFunction(async (message, bridge) => {
		try {
			await sendFile(bridge, {
				message,
				fileId: message.voice.file_id,
				fileName: "voice" + "." + mime.getExtension(message.voice.mime_type),
				resolveExtension: false
			});
		} catch (err) {
			logger.error(`[${bridge.name}] Could not send voice`, err);
		}
	}));

	// Set up event listener for audio messages
	tgBot.on("audio", wrapFunction(async (message, bridge) => {
		try {
			await sendFile(bridge, {
				message,
				fileId: message.audio.file_id,
				fileName: message.audio.title,
				resolveExtension: true
			});
		} catch (err) {
			logger.error(`[${bridge.name}] Could not send audio`, err);
		}
	}));

	// Set up event listener for video messages
	tgBot.on("video", wrapFunction(async (message, bridge) => {
		try {
			await sendFile(bridge, {
				message,
				caption: message.caption,
				fileId: message.video.file_id,
				fileName: "video" + "." + mime.getExtension(message.video.mime_type),
				resolveExtension: false
			});
		} catch (err) {
			logger.error(`[${bridge.name}] Could not send video`, err);
		}
	}));

	// Listen for users joining the chat
	tgBot.on("new_chat_members", wrapFunction(({ new_chat_members }, bridge) => {
		// Ignore it if the settings say no
		if (!bridge.telegram.relayJoinMessages) {
			return;
		}

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
	tgBot.on("left_chat_member", wrapFunction(async ({ left_chat_member }, bridge) => {
		// Ignore it if the settings say no
		if (!bridge.telegram.relayLeaveMessages) {
			return;
		}

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

	// Set up event listener for message edits
	const handleEdits = wrapFunction(async (tgMessage, bridge) => {
		try {
			// Wait for the Discord bot to become ready
			await dcBot.ready;

			// Find the ID of this message on Discord
			const [dcMessageId] = messageMap.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, bridge, tgMessage.message_id);

			// Get the messages from Discord
			const dcMessage = await dcBot.channels.get(bridge.discord.channelId).fetchMessage(dcMessageId);

			const messageObj = messageConverter(tgMessage, tgBot, settings, dcBot, bridge);

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

	// Make a promise which resolves when the dcBot is ready
	tgBot.ready = tgBot.telegram.getMe()
		.then((bot) => {
			// Log the bot's info
			logger.info(`Telegram: ${bot.username} (${bot.id})`);

			// Put the data on the bot
			tgBot.me = bot;
		})
		.catch((err) => {
			// Log the error(
			logger.error("Failed at getting the Telegram bot's me-object:", err);

			// Pass it on
			throw err;
		});

	// Start getting updates
	let p = Promise.resolve();
	if (settings.telegram.skipOldMessages) {
		// Clear old updates
		p = tgBot.telegram.getUpdates(0, 100, -1)
			.then(updates => updates.length > 0
				? tgBot.telegram.getUpdates(0, 100, updates[updates.length-1].update_id)
				: []
			);
	}
	p.then(() => tgBot.startPolling());
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
