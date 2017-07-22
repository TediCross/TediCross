"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const updateGetter = require("./updategetter");
const handleEntities = require("./handleEntities");
const wrapFunction = require("./wrapFunction");
const getDisplayName = require("./getDisplayName");
const MessageMap = require("../MessageMap");

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

	// Set up event listener for text messages from Telegram
	tgBot.on("text", wrapFunction((message) => {

		// Convert the text to Discord format
		let text = handleEntities(dcUsers, message.text, message.entities);

		// Find out who the message is from
		let fromName = getDisplayName(message.from);

		// Check if it is a reply
		if (message.reply_to_message !== undefined) {
			// Find the name of the user this is a reply to
			let inReplyTo = getDisplayName(message.reply_to_message.from);

			// Add it to the 'from' text
			fromName = `${fromName} (in reply to ${inReplyTo})`;
		}

		// Check if it is a forwarded message
		if (message.forward_from !== undefined) {
			// Find the name of the user this was forwarded from
			let forwardFrom = getDisplayName(message.forward_from);

			// Add it to the 'from' text
			fromName = `${forwardFrom} (forwarded by ${fromName})`;
		}

		// Pass it on to Discord
		dcBot.channels.get(Application.settings.discord.channelID).send(`**${fromName}**: ${text}`)
		.then((dcMessage) => {
			// Make the mapping so future edits can work
			messageMap.insert(MessageMap.TELEGRAM_TO_DISCORD, message.message_id, dcMessage.id);
		})
		.catch((err) => {
			Application.logger.error("Discord did not accept a text message:", err);
			Application.logger.error("Failed message:", message.text);
		})
	}, tgBot));

	/**
	 * Sends a file to Discord
	 *
	 * @param {String} arg.fromName	Display name of the sender
	 * @param {String} arg.fileId	ID of the file to download from Telegram's servers
	 * @param {String} arg.fileName	Name of the file to send
	 * @param {String} [arg.caption]	Additional text to send with the file
	 * @param {Boolean} [arg.resolveExtension]	Set to true if the bot should try to find the file extension itself, in which case it will be appended to the file name. Defaults to false
	 */
	function sendFile({fromName, fileId, fileName, caption = "", resolveExtension = false}) {
		// Make the text to send
		let textToSend = `**${fromName}**:\n${caption}`

		// Handle for the file extension
		let extension = "";

		// Start getting the file
		return tgBot.getFile({file_id: fileId})
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
				dcBot.channels.get(Application.settings.discord.channelID).send(
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
	}

	// Set up event listener for photo messages from Telegram
	tgBot.on("photo", wrapFunction((message) => {
		sendFile({
			fromName: getDisplayName(message.from),
			fileId: message.photo[message.photo.length-1].file_id,
			fileName: "photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
			caption: message.caption
		});
	}));

	// Set up event listener for stickers from Telegram
	tgBot.on("sticker", wrapFunction((message) => {
		sendFile({
			fromName: getDisplayName(message.from),
			fileId: message.sticker.thumb.file_id,
			fileName: "sticker.webp",	// Telegram will insist that it is a jpg, but it really is a webp
			caption: message.sticker.emoji
		});
	}));

	// Set up event listener for filetypes not caught by the other filetype handlers
	tgBot.on("document", (message) => {
		sendFile({
			fromName: getDisplayName(message.from),
			fileId: message.document.file_id,
			fileName: message.document.file_name
		});
	});

	// Set up event listener for audio messages
	tgBot.on("audio", (message) => {
		sendFile({
			fromName: getDisplayName(message.from),
			fileId: message.audio.file_id,
			fileName: message.audio.title,
			resolveExtension: true
		});
	});

	// Set up event listener for video messages
	tgBot.on("video", (message) => {
		sendFile({
			fromName: getDisplayName(message.from),
			fileId: message.video.file_id,
			fileName: "video",
			resolveExtension: true
		});
	});

	// Set up event listener for message edits
	tgBot.on("messageEdit", (tgMessage) => {
		// Create a promise chain to manage this
		Promise.resolve()
		  .then(() => messageMap.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, tgMessage.message_id))	// Try to get the corresponding message in Discord
		  .then((dcMessageId) => dcBot.channels.get(Application.settings.discord.channelID).fetchMessage(dcMessageId))	// Get the message from Discord
		  .then((dcMessage) => {
			// Convert the text to Discord format
			tgMessage.text = handleEntities(dcUsers, tgMessage.text, tgMessage.entities);

			// Find out who the message is from
			let fromName = getDisplayName(tgMessage.from);

			// Try to edit the message
			return dcMessage.edit(`**${fromName}**: ${tgMessage.text}`);
		  })
		  .catch((err) => Application.logger.error("Could not edit Discord message:", err));
	});
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
