"use strict";

/**************************
 * Import important stuff *
 **************************/

const updateGetter = require("./updategetter");
const settings = require("../settings");
const DiscordUserMap = require("../discord/DiscordUserMap");

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

	// Get the instance of the DiscordUserMap
	const dcUsers = DiscordUserMap.getInstance(settings.discord.usersfile);

	/**
	 * Converts entities (usernames, code, ...) in Telegram messages to Discord format
	 *
	 * @param {String} text	The text to handle
	 * @param {MessageEntity[]} entities	Array of entities for the text
	 *
	 * ®return {String} The fully converted string
	 */
	function handleTelegramEntities(text, entities = []) {
		// Don't mess up the original
		let substitutedText = text !== undefined ? text.split("") : [""];

		// Iterate over the entities backwards, to not fuck up the offset
		for (let i = entities.length-1; i >= 0; i--) {

			// Select the entity object
			let e = entities[i];

			// Extract the entity part
			let part = text.substring(e.offset, e.offset+e.length);

			// The string to substitute
			let substitute = part;

			// Do something based on entity type
			switch(e.type) {
				case "mention":
				case "text_mention":
					// A mention. Substitute the Discord user ID if one exists
					let username = part.substring(1);
					substitute = dcUsers.lookupUsername(username) ? `<@${dcUsers.lookupUsername(username)}>` : part;
					break;
				case "code":
					// Inline code. Add backticks
					substitute = "`" + part + "`";
					break;
				case "pre":
					// Code block. Add triple backticks
					substitute = "```\n" + part + "\n```";
					break;
				case "hashtag":
				case "url":
				case "bot_command":
				case "email":
				case "bold":
				case "italic":
				case "text_link":
				default:
					// Just leave it as it is
					break;
			}

			// Do the substitution if there is a change
			if (substitute !== part) {
				substitutedText.splice(e.offset, e.length, substitute);
			}
		}

		// Return the converted string
		return substitutedText.join("");
	}

	/**
	 * Wraps a function taking a message as a parameter so that the message is ignored if it is from the wrong chat
	 *
	 * @param {Function} func	The function to wrap
	 */
	function telegramWrapFunction(func) {
		return function(message) {
			// Check if this is a request for chat info
			if (message.text !== undefined && tgBot.me !== undefined && message.text.toLowerCase() === `@${tgBot.me.username} chatinfo`.toLowerCase()) {
				// It is. Give it
				tgBot.sendMessage({
					chat_id: message.chat.id,
					text: "chatID: " + message.chat.id
				});
			} else {
				// Check if the message came from the correct group
				if (message.chat.id == settings.telegram.chatID) {
					// Yup. Do the thing
					func(message);
				} else {
					// Tell the sender that this is a private bot
					tgBot.sendMessage({
						chat_id: message.chat.id,
						text: "This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. If you wish to use TediCross yourself, please download and create an instance. You may ask @Suppen for help"
					  })
					  .catch(err => {
						// Hmm... Could not send the message for some reason TODO Do something about this
						console.error("Could not provide chatinfo:", err, message);
					  });
				}
			}
		}
	}

	// Set up event listener for text messages from Telegram
	tgBot.on("text", telegramWrapFunction(message => {

		// Convert the text to Discord format
		message.text = handleTelegramEntities(message.text, message.entities);

		// Find out who the message is from
		let fromName = message.from.username || message.from.first_name;

		// Pass it on to Discord
		dcBot.channels.find("id", settings.discord.channelID).sendMessage(`**${fromName}**: ${message.text}`);
	}));

	// Set up event listener for photo messages from Telegram
	tgBot.on("photo", telegramWrapFunction(message => {

		// Convert the caption to Discord format
		message.caption = handleTelegramEntities(message.caption, message.entities);

		// Find out who the message is from
		let fromName = message.from.username || message.from.first_name;

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
				dcBot.channels.find("id", settings.discord.channelID).sendFile(
					Buffer.concat(buffers),
					"photo.jpg",	// Telegram will convert it to jpg no matter what filetype is actually sent
					`**${fromName}**: ${message.caption}`
				);
			});
		  })
		  .catch(err => {
			console.log("Something went wrong when relaying a photo from Telegram to Discord:", err);
		  });
	}));
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
