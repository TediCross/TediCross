"use strict";

/**************************
 * Import important stuff *
 **************************/

const moment = require("moment");

// Load the settings
const settings = require("./lib/settings");

// Telegram stuff
const { BotAPI, InputFile } = require("teleapiwrapper");
const telegramSetup = require("./lib/telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./lib/discord2telegram/setup");


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
	dcBot.on("ready", () => console.log(`Discord: ${dcBot.user.username} (${dcBot.user.id})`));
	tgBot.getMe().then(bot => {
		console.log(`Telegram: ${bot.username} (${bot.id})`)

		// Put the data on the bot
		tgBot.me = bot;
	}).catch(err => console.error("Failed at getting the Telegram bot's me-object:", err));

	/*********************
	 * Set up the bridge *
	 *********************/

	discordSetup(dcBot, tgBot);
	telegramSetup(tgBot, dcBot);
} catch (err) {
	// Log the timestamp and re-throw the error
	console.error("Crash timestamp:", moment().toISOString());
	throw err;
}
