"use strict";

/**************************
 * Import important stuff *
 **************************/

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
 * @param {Logger} logger	A logger
 * @param {Object} settings	Settings for the application
 * @param {DiscordUserMap} dcUsers	A map between discord users and their IDs
 */
function setup(tgBot, dcBot, logger, settings, dcUsers) {
	// Start longpolling
	updateGetter(tgBot, settings);

	// Set up event listener for text messages from Telegram
	tgBot.on("text", wrapFunction(message => {

		// Convert the text to Discord format
		message.text = handleEntities(dcUsers, settings, message.text, message.entities);

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
		dcBot.channels.get(settings.discord.channelID).send(`**${fromName}**: ${message.text}`)
		.then(dcMessage => {
			// Make the mapping so future edits can work
			MessageMap.instance.insert(MessageMap.TELEGRAM_TO_DISCORD, message.message_id, dcMessage.id);
		})
		.catch(err => {
			logger.error("Discord did not accept a text message:", err);
			logger.error("Failed message:", message.text);
		})
	}, tgBot));

	// Set up event listener for photo messages from Telegram
	tgBot.on("photo", wrapFunction(message => {

		// Convert the caption to Discord format
		message.caption = handleEntities(message.caption, message.entities);

		// Find out who the message is from
		let fromName = getDisplayName(message.from);

		// Download the photo
		tgBot.getFile({file_id: message.photo[message.photo.length-1].file_id})
		  .then(file => tgBot.helperGetFileStream(file))
		  .then(fileStream => {
			// Create an array of buffers to store the file in
			let buffers = [];

			// Fetch the file
			fileStream.on("data", chunk => {
				buffers.push(chunk);
			});

			// Send the file when it is fetched
			fileStream.on("end", () => {
				dcBot.channels.get(settings.discord.channelID).send(
					`**${fromName}**:\n${message.caption}`,
					{
						file: {
							attachment: Buffer.concat(buffers),
							name: "photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
						}
					}
				)
				.catch(err => logger.error("Discord did not accept a photo:", err))
			});
		  })
		  .catch(err => {
			logger.log("Something went wrong when relaying a photo from Telegram to Discord:", err);
		  });
	}, tgBot));

	// Generic file not emitted in other events
	tgBot.on("document", (message) => {
		// XXX Wet code. Mostly copied from the photo handler

		// Find out who the message is from
		let fromName = getDisplayName(message.from);

		// Download the document
		tgBot.getFile({file_id: message.document.file_id})
		  .then(file => tgBot.helperGetFileStream(file))
		  .then(fileStream => {
			// Create an array of buffers to store the file in
			let buffers = [];

			// Fetch the file
			fileStream.on("data", chunk => {
				buffers.push(chunk);
			});

			// Send the file when it is fetched
			fileStream.on("end", () => {
				dcBot.channels.get(settings.discord.channelID).send(
					`**${fromName}**`,
					{
						file: {
							attachment: Buffer.concat(buffers),
							name: message.document.file_name
						}
					}
				)
				.catch(err => logger.error("Discord did not accept a document:", err));
			});
		  })
		  .catch(err => {
			logger.log("Something went wrong when relaying a document from Telegram to Discord:", err);
		  });
	});

	// Set up event listener for audio messages
	tgBot.on("audio", (message) => {
		// XXX Wet code. Mostly copied from the photo handler

		// Find out who the message is from
		let fromName = getDisplayName(message.from);

		// Extension of the file
		let extension = "";

		// Download the audio
		tgBot.getFile({file_id: message.audio.file_id})
		  .then(file => {
			// Extract the extension from the file path. The file name is generic 'music/file_<number>.<ext>'
			extension = "." + file.file_path.split(".").reverse()[0];
			return tgBot.helperGetFileStream(file);
		  })
		  .then(fileStream => {
			// Create an array of buffers to store the file in
			let buffers = [];

			// Fetch the file
			fileStream.on("data", chunk => {
				buffers.push(chunk);
			});

			// Send the file when it is fetched
			fileStream.on("end", () => {
				dcBot.channels.get(settings.discord.channelID).send(
					`**${fromName}**`,
					{
						file: {
							attachment: Buffer.concat(buffers),
							name: message.audio.title + extension
						}
					}
				)
				.catch(err => logger.error("Discord did not accept an audio file:", err));
			});
		  })
		  .catch(err => {
			logger.log("Something went wrong when relaying an audio file from Telegram to Discord:", err);
		  });
	});

	// Set up event listener for audio messages
	tgBot.on("video", (message) => {
		// XXX Wet code. Mostly copied from the video handler

		// Find out who the message is from
		let fromName = getDisplayName(message.from);

		// Extension of the file
		let extension = "";

		// Download the video
		tgBot.getFile({file_id: message.video.file_id})
		  .then(file => {
			// Extract the extension from the file path. The file name is generic 'video/file_<number>.<ext>'
			extension = "." + file.file_path.split(".").reverse()[0];
			return tgBot.helperGetFileStream(file);
		  })
		  .then(fileStream => {
			// Create an array of buffers to store the file in
			let buffers = [];

			// Fetch the file
			fileStream.on("data", chunk => {
				buffers.push(chunk);
			});

			// Send the file when it is fetched
			fileStream.on("end", () => {
				dcBot.channels.get(settings.discord.channelID).send(
					`**${fromName}**`,
					{
						file: {
							attachment: Buffer.concat(buffers),
							name: "video" + extension
						}
					}
				)
				.catch(err => logger.error("Discord did not accept a video:", err))
			});
		  })
		  .catch(err => {
			logger.log("Something went wrong when relaying a video from Telegram to Discord:", err);
		  });
	});

	// Set up event listener for sticker messages from Telegram
	tgBot.on("sticker", wrapFunction(message => {
		// XXX Very WET code. Mostly copied from the photo handler

		// Find out who the message is from
		let fromName = getDisplayName(message.from);

		// Extension of the file
		let extension = "";

		// Download the photo
		tgBot.getFile({file_id: message.sticker.thumb.file_id})
		  .then(file => {
			extension = "." + file.file_path.split(".").reverse()[0];
			return tgBot.helperGetFileStream(file)
		  })
		  .then(fileStream => {
			// Create an array of buffers to store the file in
			let buffers = [];

			// Fetch the file
			fileStream.on("data", chunk => {
				buffers.push(chunk);
			});

			// Send the file when it is fetched
			fileStream.on("end", () => {
				dcBot.channels.get(settings.discord.channelID).send(
					`**${fromName}**:\n${message.sticker.emoji}`,
					{
						file: {
							attachment: Buffer.concat(buffers),
							name: "sticker.png"
						}
					}
				)
				.catch(err => logger.error("Discord did not accept a sticker:", err))
			});
		  })
		  .catch(err => {
			logger.log("Something went wrong when relaying a sticker from Telegram to Discord:", err);
		  });
	}, tgBot));

	// Set up event listener for message edits
	tgBot.on("messageEdit", tgMessage => {
		// Create a promise chain to manage this
		Promise.resolve()
		  .then(() => MessageMap.instance.getCorresponding(MessageMap.TELEGRAM_TO_DISCORD, tgMessage.message_id))	// Try to get the corresponding message in Discord
		  .then(dcMessageId => dcBot.channels.get(settings.discord.channelID).fetchMessage(dcMessageId))	// Get the message from Discord
		  .then(dcMessage => {
			// Convert the text to Discord format
			tgMessage.text = handleEntities(dcUsers, settings, tgMessage.text, tgMessage.entities);

			// Find out who the message is from
			let fromName = getDisplayName(tgMessage.from);

			// Try to edit the message
			return dcMessage.edit(`**${fromName}**: ${tgMessage.text}`);
		  })
		  .catch(err => logger.error("Could not edit Discord message:", err));
	});
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
