"use strict";

/**************************
 * Import important stuff *
 **************************/

// General stuff
const path = require("path");
const Logger = require("./lib/Logger");
const MessageMap = require("./lib/MessageMap");
const Bridge = require("./lib/bridgestuff/Bridge");
const BridgeMap = require("./lib/bridgestuff/BridgeMap");
const Settings = require("./lib/settings/Settings");
const migrateSettingsToYAML = require("./lib/migrateSettingsToYAML");

// Telegram stuff
const Telegraf = require("telegraf");
const telegramSetup = require("./lib/telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./lib/discord2telegram/setup");

// Arg parsing
const yargs = require("yargs");

/*************
 * TediCross *
 *************/

// Get commandline arguments if any
const args = yargs
	.alias("v", "version")
	.alias("h", "help")
	.option("config", {
		alias: "c",
		default: path.join(__dirname, "settings.yaml"),
		describe: "Specify settings file",
		type: "string"
	})
	.option("data-dir", {
		alias: "d",
		default: path.join(__dirname, "data"),
		describe: "Specify the directory to store data in",
		type: "string"
	}).argv;

// Migrate the settings from JSON to YAML
const settingsPathJSON = path.join(__dirname, "settings.json");
const settingsPathYAML = args.config || path.join(__dirname, "settings.yaml");
migrateSettingsToYAML(settingsPathJSON, settingsPathYAML);

// Get the settings
const settings = Settings.fromFile(settingsPathYAML);

// Initialize logger
const logger = new Logger(settings.debug);

// Save the settings, as they might have changed
settings.toFile(settingsPathYAML);

// Create a Telegram bot
const tgBot = new Telegraf(settings.telegram.token, { channelMode: true });

// Create a Discord bot
const dcBot = new Discord.Client();

// Create a message ID map
const messageMap = new MessageMap();

// Create the bridge map
const bridgeMap = new BridgeMap(settings.bridges.map((bridgeSettings) => new Bridge(bridgeSettings)));

/*********************
 * Set up the bridge *
 *********************/

discordSetup(logger, dcBot, tgBot, messageMap, bridgeMap, settings, args.dataDir);
telegramSetup(logger, tgBot, dcBot, messageMap, bridgeMap, settings, args.dataDir);
