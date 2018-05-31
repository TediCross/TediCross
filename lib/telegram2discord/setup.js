"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const makeUpdateEmitter = require("./makeUpdateEmitter");
const messageConverter = require("./messageConverter");
const MessageMap = require("../MessageMap");
const _ = require("lodash");
const mime = require("mime/lite");
const Bridge = require("../bridgestuff/Bridge");

/**
 * Creates a function which sends files from Telegram to discord
 *
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 * @param {DiscordUserMap} dcUsers	A map between discord users and their IDs
 * @param {Settings} settings	The settings to use
 *
 * @returns {Function}	A function which can be used to send files from Telegram to Discord
 *
 * @private
 */
function makeFileSender(tgBot, dcBot, dcUsers, settings) {
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
	return function({discordChannel, message, fileId, fileName, caption = "", resolveExtension = false}) {
		// Make the text to send
		const messageObj = messageConverter(message, dcUsers, tgBot, settings);
		const textToSend = `**${messageObj.from}**:\n${caption}`;

		// Handle for the file extension
		let extension = "";

		// Wait for the Discord bot to become ready
		return dcBot.ready
			.then(() => {
				// Start getting the file
				return tgBot.getFile({file_id: fileId});
			})
			.then((file) => {
				// Get the extension, if necessary
				if (resolveExtension) {
					extension = "." + file.file_path.split(".").pop();
				}
				return tgBot.helperGetFileStream(file);
			})
			.then((fileStream) => new Promise((resolve) => {
				// Create an array of buffers to store the file in
				const buffers = [];

				// Fetch the file
				fileStream.on("data", (chunk) => {
					buffers.push(chunk);
				});

				// Send the file when it is fetched
				fileStream.on("end", () => {
					const p = dcBot.channels.get(discordChannel).send(
						textToSend,
						{
							file: {
								attachment: Buffer.concat(buffers),
								name: fileName + extension
							}
						}
					);

					// Pass the promise back to the caller
					resolve(p);
				});
			}));
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
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 * @param {Function} func	The message handler to wrap
 * @param {Message} message	The Telegram message triggering the wrapped function
 *
 * @private
 */
const createMessageHandler = _.curry((tgBot, bridgeMap, func, message) => {
	if (message.text !== undefined && tgBot.me !== undefined && message.text.toLowerCase() === `@${tgBot.me.username} chatinfo`.toLowerCase()) {
		// This is a request for chat info. Give it, no matter which chat this is from
		tgBot.sendMessage({
			chat_id: message.chat.id,
			text: "chatID: " + message.chat.id
		});
	} else {
		// Get the bridge
		const bridge = bridgeMap.fromTelegramChatId(message.chat.id);

		// Check if the message came from the correct chat
		if (bridge === undefined) {
			// Tell the sender that this is a private bot
			tgBot.sendMessage({
				chat_id: message.chat.id,
				text: "This is an instance of a [TediCross](https://github.com/TediCross/TediCross) bot, "
					+ "bridging a chat in Telegram with one in Discord. "
					+ "If you wish to use TediCross yourself, please download and create an instance. "
					+ "Join our [Telegram group](https://t.me/TediCrossSupport) or [Discord server](https://discord.gg/MfzGMzy) for help"
				,
				parse_mode: "markdown"
			})
				.catch((err) => {
					// Hmm... Could not send the message for some reason
					Application.logger.error("Could not tell user to get their own TediCross instance:", err, message);
				});
		} else {
			// Do the thing, if this is not a discord-to-telegram bridge
			if (bridge.direction !== Bridge.DIRECTION_DISCORD_TO_TELEGRAM) {
				func(message, bridge);
			}
		}
	}
});

/**********************
 * The setup function *
 **********************/

/**
 * Sets up the receiving of Telegram messages, and relaying them to Discord
 *
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 * @param {DiscordUserMap} dcUsers	A map between discord users and their IDs
 * @param {MessageMap} messageMap	Map between IDs of messages
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 * @param {Settings} settings	The settings to use
 */
function setup(tgBot, dcBot, dcUsers, messageMap, bridgeMap, settings) {
	// Start longpolling
	const updateEmitter = makeUpdateEmitter(tgBot, settings);

	// Make the file sender
	const sendFile = makeFileSender(tgBot, dcBot, dcUsers, settings);

	// Create the message handler wrapper
	const wrapFunction = createMessageHandler(tgBot, bridgeMap);

	// Set up event listener for text messages from Telegram
	updateEmitter.on("text", wrapFunction((message, bridge) => {

		// Turn the text discord friendly
		const messageObj = messageConverter(message, dcUsers, tgBot, settings);

		// Pass it on to Discord when the dcBot is ready
		dcBot.ready.then(() => {
			return dcBot.channels.get(bridge.discord.channelId).send(messageObj.composed);
		})
			.then((dcMessage) => {
				// Make the mapping so future edits can work
				messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, message.message_id, dcMessage.id);
			})
			.catch((err) => {
				Application.logger.error(`[${bridge.name}] Discord did not accept a text message:`, err);
				Application.logger.error(`[${bridge.name}] Failed message:`, message.text);
			});
	}));

	// Set up event listener for photo messages from Telegram
	updateEmitter.on("photo", wrapFunction((message, bridge) => {
		sendFile({
			discordChannel: bridge.discord.channelId,
			message,
			fileId: message.photo[message.photo.length-1].file_id,
			fileName: "photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
			caption: message.caption
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not send photo`, err));
	}));

	// Set up event listener for stickers from Telegram
	updateEmitter.on("sticker", wrapFunction((message, bridge) => {
		sendFile({
			discordChannel: bridge.discord.channelId,
			message,
			fileId: message.sticker.thumb.file_id,
			fileName: "sticker.webp",	// Telegram will insist that it is a jpg, but it really is a webp
			caption: settings.telegram.sendEmojiWithStickers ? message.sticker.emoji : undefined
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not send sticker`, err));
	}));

	// Set up event listener for filetypes not caught by the other filetype handlers
	updateEmitter.on("document", wrapFunction((message, bridge) => {
		// message.file_name can for some reason be undefined some times.  Default to "file.ext"
		let fileName = message.document.file_name;
		if (fileName === undefined) {
			fileName = "file." + mime.getExtension(message.document.mime_type);
		}

		// Pass it on to Discord
		sendFile({
			discordChannel: bridge.discord.channelId,
			message,
			fileId: message.document.file_id,
			fileName: fileName,
			resolveExtension: false
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not send document`, err));
	}));

	// Set up event listener for voice messages
	updateEmitter.on("voice", wrapFunction((message, bridge) => {
		sendFile({
			discordChannel: bridge.discord.channelId,
			message,
			fileId: message.voice.file_id,
			fileName: "voice" + "." + mime.getExtension(message.voice.mime_type),
			resolveExtension: false
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not send voice`, err));
	}));

	// Set up event listener for audio messages
	updateEmitter.on("audio", wrapFunction((message, bridge) => {
		sendFile({
			discordChannel: bridge.discord.channelId,
			message,
			fileId: message.audio.file_id,
			fileName: message.audio.title,
			resolveExtension: true
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not send audio`, err));
	}));

	// Set up event listener for video messages
	updateEmitter.on("video", wrapFunction((message, bridge) => {
		sendFile({
			discordChannel: bridge.discord.channelId,
			message,
			caption: message.caption,
			fileId: message.video.file_id,
			fileName: "video" + "." + mime.getExtension(message.video.mime_type),
			resolveExtension: false
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not send video`, err));
	}));

	// Listen for users joining the chat
	updateEmitter.on("newParticipants", wrapFunction(({new_chat_members}, bridge) => {
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
				.catch((err) => Application.logger.error(`[${bridge.name}] Could not notify Discord about a user that joined Telegram`, err));
		});
	}));

	// Listen for users leaving the chat
	updateEmitter.on("participantLeft", wrapFunction(({left_chat_member}, bridge) => {
		// Ignore it if the settings say no
		if (!bridge.telegram.relayLeaveMessages) {
			return;
		}

		// Make the text to send
		const nameObj = makeNameObject(left_chat_member);
		const text = `**${nameObj.name} (${nameObj.username})** left the Telegram side of the chat`;

		// Pass it on
		dcBot.ready.then(() => {
			return dcBot.channels.get(bridge.discord.channelId).send(text);
		})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not notify Discord about a user that left Telegram`, err));

	}));

	// Set up event listener for message edits
	updateEmitter.on("messageEdit", wrapFunction((tgMessage, bridge) => {
		// Wait for the Discord bot to become ready
		dcBot.ready
			// Try to get the corresponding message in Discord
			.then(() => messageMap.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, tgMessage.message_id))
			// Get the message from Discord
			.then((dcMessageId) => dcBot.channels.get(bridge.discord.channelId).fetchMessage(dcMessageId))
			.then((dcMessage) => {

				const messageObj = messageConverter(tgMessage, dcUsers, tgBot, settings);

				// Try to edit the message
				return dcMessage.edit(messageObj.composed);
			})
			.catch((err) => {
				// Log it
				Application.logger.error(`[${bridge.name}] Could not edit Discord message:`, err);
			});
	}));

	// Make a promise which resolves when the dcBot is ready
	tgBot.ready = tgBot.getMe()
		.then((bot) => {
			// Log the bot's info
			Application.logger.info(`Telegram: ${bot.username} (${bot.id})`);

			// Put the data on the bot
			tgBot.me = bot;
		})
		.catch((err) => {
			// Log the error(
			Application.logger.error("Failed at getting the Telegram bot's me-object:", err);

			// Pass it on
			throw err;
		});
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
