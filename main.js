"use strict";

/**************************
 * Import important stuff *
 **************************/

const Logger = require("./lib/Logger");

// Load the settings
const settings = require("./lib/settings");

// Telegram stuff
const { BotAPI, InputFile } = require("teleapiwrapper");
const telegramSetup = require("./lib/telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./lib/discord2telegram/setup");

// Create a logger
const logger = new Logger();

// Wrap everything in a try/catch to get a timestamp when a crash occurs
try {
	/*************
	 * TediCross *
	 *************/

	// Create a Telegram bot
	const tgBot = new BotAPI(settings.telegram.auth.token);

	// Create a Discord bot
	const dcBot = new Discord.Client();

	// Log data when the bots are ready
	dcBot.on("ready", () => logger.info(`Discord: ${dcBot.user.username} (${dcBot.user.id})`));
	tgBot.getMe().then(bot => {
		logger.info(`Telegram: ${bot.username} (${bot.id})`)

		// Put the data on the bot
		tgBot.me = bot;
	}).catch(err => logger.error("Failed at getting the Telegram bot's me-object:", err));

	/*********************
	 * Set up the bridge *
	 *********************/

	discordSetup(dcBot, tgBot, logger);
	telegramSetup(tgBot, dcBot, logger);
} catch (err) {
	// Log the timestamp and re-throw the error
	logger.error(err);
	throw err;
}
