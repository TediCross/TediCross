"use strict";

/**************************
 * Import important stuff *
 **************************/

// General stuff
const yargs = require("yargs");
const path = require("path");
const Logger = require("./src/Logger");
const MessageMap = require("./src/MessageMap");
const Bridge = require("./src/bridgestuff/Bridge");
const BridgeMap = require("./src/bridgestuff/BridgeMap");
const Settings = require("./src/settings/Settings");
const migrateSettingsToYAML = require("./src/migrateSettingsToYAML");
const jsYaml = require("js-yaml");
const fs = require("fs");
const R = require("ramda");
const os = require("os");

// Telegram stuff
const Telegraf = require("telegraf");
const telegramSetup = require("./src/telegram2discord/setup");

// Discord stuff
const Discord = require("discord.js");
const discordSetup = require("./src/discord2telegram/setup");

/*************
 * TediCross *
 *************/

// Get command line arguments if any
const args = yargs
	.alias("v", "version")
	.alias("h", "help")
	.option("config", {
		alias: "c",
		default: path.join(__dirname, "settings.yaml"),
		describe: "Specify path to settings file",
		type: "string"
	})
	.option("data-dir", {
		alias: "d",
		default: path.join(__dirname, "data"),
		describe: "Specify the path to the directory to store data in",
		type: "string"
	}).argv;

// Migrate the settings from JSON to YAML
const settingsPathJSON = path.join(__dirname, "settings.json");
const settingsPathYAML = args.config;
migrateSettingsToYAML(settingsPathJSON, settingsPathYAML);

// Get the settings
const rawSettingsObj = jsYaml.safeLoad(fs.readFileSync(settingsPathYAML));
const settings = Settings.fromObj(rawSettingsObj);

// Initialize logger
const logger = new Logger(settings.debug);

// Write the settings back to the settings file if they have been modified
const newRawSettingsObj = settings.toObj();
if (R.not(R.equals(rawSettingsObj, newRawSettingsObj))) {
	// Turn it into notepad friendly YAML
	const yaml = jsYaml.safeDump(newRawSettingsObj).replace(/\n/g, "\r\n");

	try {
		fs.writeFileSync(settingsPathYAML, yaml);
	} catch (err) {
		if (err.code === "EACCES") {
			// The settings file is not writable. Give a warning
			logger.warn("Changes to TediCross' settings have been introduced. Your settings file it not writable, so it could not be automatically updated. TediCross will still work, with the modified settings, but you will see this warning until you update your settings file");

			// Write the settings to temp instead
			const tmpPath = path.join(os.tmpdir(), "tedicross-settings.yaml");
			try {
				fs.writeFileSync(tmpPath, yaml);
				logger.info(`The new settings file has instead been written to '${tmpPath}'. Copy it to its proper location to get rid of the warning`);
			} catch (err) {
				logger.warn(`An attempt was made to put the modified settings file at '${tmpPath}', but it could not be done. See the following error message`);
				logger.warn(err);
			}
		}
	}
}

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
