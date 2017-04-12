"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");

const updateGetter = require("./updategetter");
const settings = require("../settings");
const handleEntities = require("./handleEntities");
const wrapFunction = require("./wrapFunction");
const getDisplayName = require("./getDisplayName");

/**********************
 * The setup function *
 **********************/

/**
 * Sets up the receiving of Telegram messages, and relaying them to Discord
 *
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 */
function setup(tgBot, dcBot) {
	// Start longpolling
	updateGetter(tgBot);

	// Set up event listener for text messages from Telegram
	tgBot.on("text", wrapFunction(message => {

		// Convert the text to Discord format
		message.text = handleEntities(message.text, message.entities);

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
		dcBot.channels.get(settings.discord.channelID).sendMessage(`**${fromName}**: ${message.text}`);
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
				dcBot.channels.get(settings.discord.channelID).sendFile(
					Buffer.concat(buffers),
					"photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
					`**${fromName}**:\n${message.caption}`
				);
			});
		  })
		  .catch(err => {
			console.log("Something went wrong when relaying a photo from Telegram to Discord:", err);
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
				dcBot.channels.get(settings.discord.channelID).sendFile(
					Buffer.concat(buffers),
					message.document.file_name,
					`**${fromName}**`
				);
			});
		  })
		  .catch(err => {
			console.log("Something went wrong when relaying a document from Telegram to Discord:", err);
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
				dcBot.channels.get(settings.discord.channelID).sendFile(
					Buffer.concat(buffers),
					message.audio.title + extension,
					`**${fromName}**`
				);
			});
		  })
		  .catch(err => {
			console.log("Something went wrong when relaying an audio file from Telegram to Discord:", err);
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
				dcBot.channels.get(settings.discord.channelID).sendFile(
					Buffer.concat(buffers),
					"video" + extension,
					`**${fromName}**`
				);
			});
		  })
		  .catch(err => {
			console.log("Something went wrong when relaying a video from Telegram to Discord:", err);
		  });
	});
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
