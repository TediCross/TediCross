"use strict";

/**************************
 * Import important stuff *
 **************************/

// Load the settings
const settings = require("./settings");

// Telegram stuff
const { BotAPI, InputFile } = require("teleapiwrapper");
const telegramSetup = require("./telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./discord2telegram/setup");

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
});

/*********************
 * Set up the bridge *
 *********************/

discordSetup(dcBot, tgBot);
telegramSetup(tgBot, dcBot);
