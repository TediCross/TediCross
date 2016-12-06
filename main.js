"use strict";

/**************************
 * Import important stuff *
 **************************/

// General stuff
const stream = require("stream");
const fs = require("fs");
const request = require("request");

// Telegram stuff
const { BotAPI, InputFile } = require("teleapiwrapper");
const updateGetter = require("./updategetter.js");

// Discord stuff
const Discord = require("discord.js");
const DiscordUserMap = require("./DiscordUserMap");

/**************************
 * Read the settings file *
 **************************/

const settings = JSON.parse(fs.readFileSync("settings.json"));

/*************
 * TediCross *
 *************/

// Create a Telegram bot and start longpolling for updates
const tgBot = new BotAPI(settings.telegram.auth.token);
updateGetter(tgBot, settings.telegram.timeout);

// Create a Discord bot
const dcBot = new Discord.Client();
// The bot is started at the bottom (dcBot.login())

// Mapping between usernames and IDs
const dcUsers = new DiscordUserMap(settings.discord.usersfile);

// Log data when the bots are ready
dcBot.on("ready", () => console.log(`Discord: ${dcBot.user.username} (${dcBot.user.id})`));
tgBot.getMe().then(bot => {
	console.log(`Telegram: ${bot.username} (${bot.id})`)

	// Put the data on the bot
	tgBot.me = bot;
});

/***************************
 * Set up the Discord part *
 ***************************/

// Save the bot's known users when the bot is ready
dcBot.on("ready", () => {
	// Save the bot's usermap
	for (let [userId, {username}] of dcBot.users) {

		// Store the UserID/Username mapping
		if (username && userId) {
			dcUsers.mapID(userId).toUsername(username);
		}
	}
});

// Listen for presence to get name/ID mapping
dcBot.on("presenceUpdate", (oldMember, newMember) => {
	// Get info about the user
	let userName = newMember.user.username;
	let userId = newMember.user.id;

	// Store the UserID/Username mapping
	dcUsers.mapID(userId).toUsername(userName);
});

// Listen for Discord messages
dcBot.on("message", message => {

	// Check if this is a request for server info
	if (message.cleanContent.toLowerCase() === `@${dcBot.user.username} chatinfo`.toLowerCase()) {
		// It is. Give it
		message.reply(
			"channelID: " + message.channel.id + "\n" +
			"serverID: " + message.guild.id + "\n" +
			"botID: " + dcBot.user.id
		);
		return;
	}

	// Get info about the sender
	let senderName = message.author.username;
	let senderId = message.author.id;

	// Store the UserID/Username mapping
	dcUsers.mapID(senderId).toUsername(senderName);

	// Don't do anything with the bot's own messages
	if (senderId !== settings.discord.botID) {

		// Check if the message is from the correct chat
		if (message.channel.id === settings.discord.channelID) {

			// Modify the message to fit Telegram
			let processedMessage = message.cleanContent
			  .replace(/<@!?(\d+)>/g, (m, id) => {	// @ID to @Username
				if (dcUsers.lookupID(id)) {
					return `@${dcUsers.lookupID(id)}`;
				} else {
					return m;
				}
			  })

			// Pass it on to Telegram
			tgBot.sendMessage({
				chat_id: settings.telegram.chatID,
				text: `**${senderName}:** ${processedMessage}`,
				parse_mode: "Markdown"
			});
		} else if (message.channel.guild.id !== settings.discord.serverID) {	// Check if it is the correct server
			// Inform the sender that this is a private bot
			message.reply("This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. If you wish to use TediCross yourself, please download and create an instance. You may ask @Suppen for help");
		}
	}
});

// Start the Discord bot
dcBot.login(settings.discord.auth.token);

/************************
 * Set up Telegram part *
 ************************/

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
	let substitutedText = text.split("");

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
	dcBot.channels.find("id", settings.discord.channelID).sendMessage(`**${fromName}:** ${message.text}`);
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
				message.caption
			);
		});
	  })
	  .catch(err => console.log(err));
}));
