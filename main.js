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

// Create a Telegram bot
const tgBot = new BotAPI(settings.telegram.auth.token);
updateGetter(tgBot, settings.telegram.timeout);

// Create a Discord bot
const dcBot = new Discord.Client({
	token: settings.discord.auth.token,
	autorun: true
});


// Log data when the bots are ready
dcBot.on("ready", () => console.log(`Discord: ${dcBot.username} (${dcBot.id})`));
tgBot.getMe().then(bot => console.log(`Telegram: ${bot.username} (${bot.id})`));

// Read the UserID/Username map for Discord
const dcUsers = JSON.parse(fs.readFileSync(settings.discord.usersfile, "utf8"));

// Update the UserID/Username map every 30 seconds
setInterval(() => fs.writeFile(settings.discord.usersfile, JSON.stringify(dcUsers, undefined, "\t")), 30000);

/****************
 * From Discord *
 ****************/

dcBot.on("any", e => {
	if (e.t === "GUILD_CREATE") {
		e.d.members.forEach(member => {
			dcUsers[member.user.id] = member.user.username;
		});
	} else if (e.t === "MESSAGE_CREATE") {
		if(e.d.attachments) {
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
dcBot.on("presence", (user, userID) => { dcUsers[userID] = user; });

// Listen for Discord messages
dcBot.on("message", (user, userID, channelID, message, event) => {
	// Store the UserID/Username mapping
	dcUsers[userID] = user;

	// Ignore own messages
	if (userID !== settings.discord.botID) {
		debug(`Got message: \`${message}\` from Discord-user: ${user} (${userID})`);

		// Pass the message on to Telegram
		tgBot.sendMessage({
			chat_id: settings.telegram.chat_id,
			text: `<b>${user}</b>: ${message
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/&/g, "&amp;")
				.replace(/\*\*([^*]+)\*\*/g, (m, b) => "<b>" + b + "</b>")
				.replace(/\*([^*]+)\*/g, (m, b) => "<i>" + b + "</i>")
				.replace(/_([^*]+)_/g, (m, b) => "<i>" + b + "</i>")
				.replace(/<@!(\d+)>/g, (m, id) => {
					if (dcUsers[id]) {
						return `@${dcUsers[id]}`;
					} else {
						return m;
					}
				})}`,
			parse_mode: "HTML"
		});
	}
});

/*****************
 * From Telegram *
 *****************/

// Set up event listener for text messages from Telegram
tgBot.on("text", message => {
	debug(`Got message: \`${message.text}\` from Telegram-user: ${message.from.username || message.from.first_name} (${message.from.id})`);

	// Pass it on to Discord
	dcBot.sendMessage({
		to: settings.discord.channelID,
		message: `**${message.from.username || message.from.first_name}:** ${message.text}`
	});
});
