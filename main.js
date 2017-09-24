"use strict";

/**************************
 * Import important stuff *
 **************************/

// General stuff
const path = require("path");
const Application = require("./lib/Application");
const MessageMap = require("./lib/MessageMap");
const DiscordUserMap = require("./lib/discord2telegram/DiscordUserMap");

// Telegram stuff
const { BotAPI, InputFile } = require("teleapiwrapper");
const telegramSetup = require("./lib/telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./lib/discord2telegram/setup");

/*************
 * TediCross *
 *************/

// Wrap everything in a try/catch to get a timestamp if a crash occurs
try {
	// Create/Load the discord user map
	const dcUsers = new DiscordUserMap(path.join(__dirname, "data", "discord_users.json"));

	// Create a message ID map
	const messageMap = new MessageMap();

	// Create a Telegram bot
	const tgBot = new BotAPI(Application.settings.telegram.auth.token);

	// Create a Discord bot
	const dcBot = new Discord.Client();

	// Log data when the bots are ready
	dcBot.on("ready", () => Application.logger.info(`Discord: ${dcBot.user.username} (${dcBot.user.id})`));
	tgBot.getMe()
	  .then(bot => {
		// Log the bot's info
		Application.logger.info(`Telegram: ${bot.username} (${bot.id})`)

		// Put the data on the bot
		tgBot.me = bot;
	  })
	  .catch(err => Application.logger.error("Failed at getting the Telegram bot's me-object:", err));

	/*********************
	 * Set up the bridge *
	 *********************/

	discordSetup(dcBot, tgBot, dcUsers, messageMap);
	telegramSetup(tgBot, dcBot, dcUsers, messageMap);
} catch (err) {
	// Log the timestamp and re-throw the error
	Application.logger.error(err);
	throw err;
}
