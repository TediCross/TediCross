"use strict";

/**************************
 * Import important stuff *
 **************************/

const stream = require("stream");
const fs = require("fs");
const http = require("http");
const https = require("https");

const { BotAPI, InputFile } = require("teleapiwrapper");
const Discord = require("discord.io");
const updateGetter = require("./updategetter.js");

const DiscordUserMap = require("./DiscordUserMap");

/**************************
 * Read the settings file *
 **************************/

const settings = JSON.parse(fs.readFileSync("settings.json"));

/*************************************
 * Get and set up the debug function *
 *************************************/

const debug = require("./debugFunc");
debug.doDebug = settings.debug;

/*************
 * TediCross *
 *************/

// Create a Telegram bot and start longpolling for updates
const tgBot = new BotAPI(settings.telegram.auth.token);
updateGetter(tgBot, settings.telegram.timeout);

// Create a Discord bot
const dcBot = new Discord.Client({
	token: settings.discord.auth.token,
	autorun: true
});

// Mapping between usernames and IDs
const dcUsers = new DiscordUserMap(settings.discord.usersfile);

// Log data when the bots are ready
dcBot.on("ready", () => console.log(`Discord: ${dcBot.username} (${dcBot.id})`));
tgBot.getMe().then(bot => console.log(`Telegram: ${bot.username} (${bot.id})`));

/***************************
 * Set up the Discord part *
 ***************************/

dcBot.on("any", e => {
	if (e.t === "GUILD_CREATE") {
		e.d.members.forEach(member => {
			dcUsers.mapID(member.user.id).toUsername(member.user.username);
		});
	} else if (e.t === "MESSAGE_CREATE") {
		if (e.d.attachments) {
			e.d.attachments.forEach(attachment => {
				const req = attachment.url[4] === "s" ? https.get(attachment.url) : http.get(attachment.url);
				req.on("response", res => {
					const s = new stream.PassThrough();
					tgBot.sendPhoto({
						chat_id: settings.telegram.chat_id,
						photo: new InputFile(s, attachment.url.split("/").pop())
					});
					res.pipe(s);
				});
			});
		}
	}
});

// Listen for presence
dcBot.on("presence", (user, userID) => {
	// Store the UserID/Username mapping
	dcUsers.mapID(userID).toUsername(user);
});

// Listen for Discord messages
dcBot.on("message", (user, userID, channelID, message, event) => {
	// Store the UserID/Username mapping
	dcUsers.mapID(userID).toUsername(user);

	// Ignore own messages
	if (userID !== settings.discord.botID) {
		debug(`Got message: \`${message}\` from Discord-user: ${user} (${userID})`);

		// Modify the message to fit Telegram
		message = message
		  .replace(/<@!?(\d+)>/g, (m, id) => {	// @ID to @Username
			if (dcUsers.lookupID(id)) {
				return `@${dcUsers.lookupID(id)}`;
			} else {
				return m;
			}
		  })
		  .replace(/</g, "&lt;")	// < to &lt;
		  .replace(/>/g, "&gt;")	// > to &gt;
		  .replace(/&/g, "&amp;")	// & to &amp;
		  .replace(/\*\*([^*]+)\*\*/g, (m, b) => "<b>" + b + "</b>")	// **text** to <b>text</b>
		  .replace(/\*([^*]+)\*/g, (m, b) => "<i>" + b + "</i>")	// *text* to <i>text</i>
		  .replace(/_([^*]+)_/g, (m, b) => "<i>" + b + "</i>")	// _text_ to <i>text</i>

		// Pass the message on to Telegram
		tgBot.sendMessage({
			chat_id: settings.telegram.chat_id,
			text: `<b>${user}</b>: ${message}`,
			parse_mode: "HTML"
		});
	}
});

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
	let substitutedText = text;

	// Iterate over the entities backwards, to not fuck up the offset
	for (let i = entities.length-1; i >= 0; i--) {

		// Select the entity object
		let e = entities[i];

		// Extract the entity part
		let part = substitutedText.substring(e.offset, e.offset+e.length);

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
			substitutedText = substitutedText.split("");
			substitutedText.splice(e.offset, e.length, substitute);
			substitutedText = substitutedText.join("");
		}
	}

	// Return the converted string
	return substitutedText;
}

// Set up event listener for text messages from Telegram
tgBot.on("text", message => {
	debug(`Got message: \`${message.text}\` from Telegram-user: ${message.from.username || message.from.first_name} (${message.from.id})`);

	// Convert the text to Discord format
	message.text = handleTelegramEntities(message.text, message.entities);

	// Pass it on to Discord
	dcBot.sendMessage({
		to: settings.discord.channelID,
		message: `**${message.from.username || message.from.first_name}:** ${message.text}`
	});
});
