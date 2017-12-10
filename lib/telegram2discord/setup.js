"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const updateGetter = require("./updategetter");
const handleEntities = require("./handleEntities");
const MessageMap = require("../MessageMap");
const _ = require("lodash");

/********************
 * Helper functions *
 ********************/

/**
 * Gets the display name of a user
 *
 * @param {Object} user	A user object
 * @param {Object} chat	A chat object
 *
 * @return {String}	The user's display name
 *
 * @private
 */
function getDisplayName(user, chat) {
	// Handle for the result
	let displayName = null;

	try {
		// Extract the username
		displayName = user.username;

		// Check whether or not to use names instead (or if the username does not exist
		if (!displayName || Application.settings.telegram.useFirstNameInsteadOfUsername) {
			displayName = user.first_name;
		}
	} catch (err) {
		// No user given. Use the chat title instead
		displayName = chat.title;
	}

	return displayName;
}

/**
 * Creates a function which sends files from Telegram to discord
 *
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 *
 * @returns {Function}	A function which can be used to send files from Telegram to Discord
 *
 * @private
 */
function makeFileSender(tgBot, dcBot) {
	/**
	 * Sends a file to Discord
	 *
	 * @param {String} arg.discordChannel Discord channel ID
	 * @param {String} arg.fromName	Display name of the sender
	 * @param {String} arg.fileId	ID of the file to download from Telegram's servers
	 * @param {String} arg.fileName	Name of the file to send
	 * @param {String} [arg.caption]	Additional text to send with the file
	 * @param {Boolean} [arg.resolveExtension]	Set to true if the bot should try to find the file extension itself, in which case it will be appended to the file name. Defaults to false
	 */
	return function({discordChannel, fromName, fileId, fileName, caption = "", resolveExtension = false}) {
		// Make the text to send
		let textToSend = `**${fromName}**:\n${caption}`

		// Handle for the file extension
		let extension = "";

		// Wait for the Discord bot to become ready
		dcBot.ready.then(() => {
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
		  .then((fileStream) => {
			// Create an array of buffers to store the file in
			let buffers = [];

			// Fetch the file
			fileStream.on("data", (chunk) => {
				buffers.push(chunk);
			});

			// Send the file when it is fetched
			fileStream.on("end", () => {
				dcBot.channels.get(discordChannel).send(
					textToSend,
					{
						file: {
							attachment: Buffer.concat(buffers),
							name: fileName + extension
						}
					}
				)
				.catch((err) => Application.logger.error("Discord did not accept a photo:", err))
			});
		  });
	};
}


/**
 * Curryed function creating handlers handling messages which should not be relayed, and passing through those which should
 *
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {Function} func	The message handler to wrap
 * @param {Message} message	The Telegram message triggering the wrapped function
 *
 * @private
 */
const createMessageHandler = _.curry((tgBot, func, message) => {
	if (message.text !== undefined && tgBot.me !== undefined && message.text.toLowerCase() === `@${tgBot.me.username} chatinfo`.toLowerCase()) {
		// This is a request for chat info. Give it, no matter which chat this is from
		tgBot.sendMessage({
			chat_id: message.chat.id,
			text: "chatID: " + message.chat.id
		});
	} else {
		// Check if the message came from the correct chat
		if (!Application.chats.has("telegram", message.chat.id)) {
			// Tell the sender that this is a private bot
			tgBot.sendMessage({
				chat_id: message.chat.id,
				text: "This is an instance of a [TediCross](https://github.com/Suppen/TediCross) bot, bridging a chat in Telegram with one in Discord. If you wish to use TediCross yourself, please download and create an instance. You may ask @Suppen for help",
				parse_mode: "markdown"
			  })
			  .catch((err) => {
				// Hmm... Could not send the message for some reason TODO Do something about this
				console.error("Could not tell user to get their own TediCross instance:", err, message);
			  });
		} else {
			// Do the thing
			const chat = Application.chats.getChat("telegram", message.chat.id);
			func(message, chat);
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
 */
function setup(tgBot, dcBot, dcUsers, messageMap) {
	// Start longpolling
	updateGetter(tgBot, Application.settings);

	// Make the file sender
	const sendFile = makeFileSender(tgBot, dcBot);

	// Create the message handler wrapper
	const wrapFunction = createMessageHandler(tgBot);

	// Set up event listener for text messages from Telegram
	tgBot.on("text", wrapFunction((message, chat) => {

		// Convert the text to Discord format
		let text = handleEntities(dcUsers, message.text, message.entities);

		// Find out who the message is from
		let fromName = getDisplayName(message.from, message.chat);

		// Check if it is a reply
		if (message.reply_to_message !== undefined) {
			// Get the name of the user this is a reply to
			let inReplyTo = getDisplayName(message.reply_to_message.from, message.chat);

			// Is this a reply to the bot, i.e. to a Discord user?
			if (message.reply_to_message.from.id === tgBot.me.id) {
				// Get the name of the Discord user this is a reply to
				// TODO Maybe a mapping, so the name doesn't have to be parsed out of the message?
				let dcUsername = message.reply_to_message.text.split("\n")[0];
				inReplyTo = dcUsers.lookupUsername(dcUsername) ? `<@${dcUsers.lookupUsername(dcUsername)}>` : dcUsername;
			}

			// Add it to the 'from' text
			fromName = `${fromName} (in reply to ${inReplyTo})`;
		}

		// Check if it is a forwarded message
		if (message.forward_from !== undefined) {
			// Find the name of the user this was forwarded from
			let forwardFrom = getDisplayName(message.forward_from, message.chat);

			// Add it to the 'from' text
			fromName = `${forwardFrom} (forwarded by ${fromName})`;
		}

		// Pass it on to Discord when the dcBot is ready
		dcBot.ready.then(() => {
			return dcBot.channels.get(chat.discord.channel).send(`**${fromName}**: ${text}`);
		  })
		  .then((dcMessage) => {
			// Make the mapping so future edits can work
			messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, message.message_id, dcMessage.id);
		  })
		  .catch((err) => {
			Application.logger.error(`[${chat.name}] Discord did not accept a text message:`, err);
			Application.logger.error(`[${chat.name}] Failed message:`, message.text);
		  })
	}));

	// Set up event listener for photo messages from Telegram
	tgBot.on("photo", wrapFunction((message, chat) => {
		sendFile({
			discordChannel: chat.discord.channel,
			fromName: getDisplayName(message.from, message.chat),
			fileId: message.photo[message.photo.length-1].file_id,
			fileName: "photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
			caption: message.caption
		});
	}));

	// Set up event listener for stickers from Telegram
	tgBot.on("sticker", wrapFunction((message, chat) => {
		sendFile({
			discordChannel: chat.discord.channel,
			fromName: getDisplayName(message.from, message.chat),
			fileId: message.sticker.thumb.file_id,
			fileName: "sticker.webp",	// Telegram will insist that it is a jpg, but it really is a webp
			caption: message.sticker.emoji
		});
	}));

	// Set up event listener for filetypes not caught by the other filetype handlers
	tgBot.on("document", wrapFunction((message, chat) => {
		sendFile({
			discordChannel: chat.discord.channel,
			fromName: getDisplayName(message.from, message.chat),
			fileId: message.document.file_id,
			fileName: message.document.file_name
		});
	}));

	// Set up event listener for audio messages
	tgBot.on("audio", wrapFunction((message, chat) => {
		sendFile({
			discordChannel: chat.discord.channel,
			fromName: getDisplayName(message.from, message.chat),
			fileId: message.audio.file_id,
			fileName: message.audio.title,
			resolveExtension: true
		});
	}));

	// Set up event listener for video messages
	tgBot.on("video", wrapFunction((message, chat) => {
		sendFile({
			discordChannel: chat.discord.channel,
			fromName: getDisplayName(message.from, message.chat),
			fileId: message.video.file_id,
			fileName: "video",
			resolveExtension: true
		});
	}));

	// Set up event listener for message edits
	tgBot.on("messageEdit", wrapFunction((tgMessage, chat) => {
		// Wait for the Discord bot to become ready
		dcBot.ready.then(() => messageMap.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, tgMessage.message_id))	// Try to get the corresponding message in Discord
		  .then((dcMessageId) => dcBot.channels.get(chat.discord.channel).fetchMessage(dcMessageId))	// Get the message from Discord
		  .then((dcMessage) => {
			// Convert the text to Discord format
			tgMessage.text = handleEntities(dcUsers, tgMessage.text, tgMessage.entities);

			// Find out who the message is from
			let fromName = getDisplayName(tgMessage.from, tgMessage.chat);

			// Try to edit the message
			return dcMessage.edit(`**${fromName}**: ${tgMessage.text}`);
		  })
		  .catch((err) => Application.logger.error(`[${chat.name}] Could not edit Discord message:`, err));
	}));

	// Make a promise which resolves when the dcBot is ready
	tgBot.ready = tgBot.getMe()
	  .then(bot => {
		// Log the bot's info
		Application.logger.info(`Telegram: ${bot.username} (${bot.id})`)

		// Put the data on the bot
		tgBot.me = bot;
	  })
	  .catch(err => {
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
