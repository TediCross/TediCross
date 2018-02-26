"use strict";

/**************************
 * Import important stuff *
 **************************/

// General stuff
const path = require("path");
const Application = require("./lib/Application");
const MessageMap = require("./lib/MessageMap");
const DiscordUserMap = require("./lib/discord2telegram/DiscordUserMap");
const Bridge = require("./lib/Bridge");
const BridgeMap = require("./lib/BridgeMap");
const Settings = require("./lib/Settings");

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
	// Get the settings
	const settingsPath = path.join(__dirname, "settings.json");
	const settings = Settings.fromFile(settingsPath);

	// Save the settings
	settings.toFile(settingsPath);

	// Create/Load the discord user map
	const dcUsers = new DiscordUserMap(path.join(__dirname, "data", "discord_users.json"));

	// Create a message ID map
	const messageMap = new MessageMap();

	// Create the bridge map
	const bridgeMap = new BridgeMap(settings.bridges.map((bridgeSettings) => new Bridge(bridgeSettings)));

	// Create a Telegram bot
	const tgBot = new BotAPI(settings.telegramToken);

	// Create a Discord bot
	const dcBot = new Discord.Client();

	/*********************
	 * Set up the bridge *
	 *********************/

	discordSetup(dcBot, tgBot, dcUsers, messageMap, bridgeMap, settings);
	telegramSetup(tgBot, dcBot, dcUsers, messageMap, bridgeMap, settings);
} catch (err) {
	// Log the timestamp and re-throw the error
	Application.logger.error(err);
	throw err;
}
