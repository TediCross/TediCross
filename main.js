"use strict";

/**************************
 * Import important stuff *
 **************************/

// General stuff
const Logger = require("./lib/Logger");
const MessageMap = require("./lib/MessageMap");

// Telegram stuff
const { BotAPI, InputFile } = require("teleapiwrapper");
const telegramSetup = require("./lib/telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./lib/discord2telegram/setup");
const DiscordUserMap = require("./lib/discord2telegram/DiscordUserMap");

/*************
 * TediCross *
 *************/

// Create a logger
const logger = new Logger();

// Wrap everything in a try/catch to get a timestamp if a crash occurs
try {
	// Load the settings
	const settings = require("./lib/settings");

	// Create/Load the discord user map
	const dcUsers = new DiscordUserMap(settings.discord.usersfile);

	// Create a Telegram bot
	const tgBot = new BotAPI(settings.telegram.auth.token);

	// Create a Discord bot
	const dcBot = new Discord.Client();

	// Create a message ID map
	const messageMap = new MessageMap();

	// Log data when the bots are ready
	dcBot.on("ready", () => logger.info(`Discord: ${dcBot.user.username} (${dcBot.user.id})`));
	tgBot.getMe()
	  .then(bot => {
		logger.info(`Telegram: ${bot.username} (${bot.id})`)

		// Put the data on the bot
		tgBot.me = bot;
	  })
	  .catch(err => logger.error("Failed at getting the Telegram bot's me-object:", err));

	/*********************
	 * Set up the bridge *
	 *********************/

	discordSetup(dcBot, tgBot, logger, settings, dcUsers, messageMap);
	telegramSetup(tgBot, dcBot, logger, settings, dcUsers, messageMap);
} catch (err) {
	// Log the timestamp and re-throw the error
	logger.error(err);
	throw err;
}
