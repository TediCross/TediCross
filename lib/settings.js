"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const path = require("path");

// XXX This file is imported from `Application` and can therefore not import that in order to not get circular dependencies
// This means that `Application.logger` cannot be used here. Use `console` instead

/**************************
 * Read the settings file *
 **************************/

/**
 * Path to the settings file
 *
 * @type String
 * @private
 */
const settingsPath = path.join(__dirname, "..", "settings.json");

/**
 * The settings object
 *
 * @type Object
 */
const settings = JSON.parse(fs.readFileSync(settingsPath));

// Load the list of chat's stuff
if (settings.bridgeMap === undefined) {
	settings.bridgeMap = [];
}

// Add the deprecated chat settings to new bridgeMap
if (settings.bridgeMap.length === 0) {
	// Check if old settings should be migrated
	let migrate = (
		settings.telegram.chatID !== "TELEGRAM CHAT ID HERE" &&
		settings.discord.channelID !== "DISCORD CHANNEL ID HERE" &&
		settings.discord.serverID !== "SERVER (GUILD) ID HERE"
	);
	if (migrate) {
		settings.bridgeMap.push({
			name: "Default bridge",
			telegram: settings.telegram.chatID,
			discord: {
				guild: settings.discord.serverID,
				channel: settings.discord.channelID
			}
		});
	}
}

// Make sure Telegram has an integer as chat id
for (let bridgeMap in settings.bridgeMap) {
    settings.bridgeMap[bridgeMap].telegram = Number.parseInt(settings.bridgeMap[bridgeMap].telegram);
}

// Deprecate old channel, server guild and chat id
if (settings.telegram.chatID !== undefined) {
	delete settings.telegram.chatID;
}
if (settings.discord.channelID !== undefined) {
	delete settings.discord.channelID;
}
if (settings.discord.serverID !== undefined) {
	delete settings.discord.serverID;
}

// Set default debug value
if (settings.debug === undefined) {
	settings.debug = false;
}

// Set the default name settings
if (settings.telegram.useFirstNameInsteadOfUsername === undefined) {
	settings.telegram.useFirstNameInsteadOfUsername = false;
}

// Set default colon values
if (settings.telegram.colonAfterSenderName === undefined) {
	settings.telegram.colonAfterSenderName = false;
}

// Set default skipOldMessages values
if (settings.telegram.skipOldMessages === undefined) {
	settings.telegram.skipOldMessages = true;
}
if (settings.discord.skipOldMessages === undefined) {
	settings.discord.skipOldMessages = true;
}

// The discord.usersfile setting is deprecated
if (settings.discord.usersfile !== undefined) {
	// Get the path of the file, according to the settings
	const currentPath = path.join(process.cwd(), settings.discord.usersfile);

	// Build the new path
	const newPath = path.join(__dirname, "..", "data", "discord_users.json");

	// Try to move it
	fs.rename(currentPath, newPath, (err) => {	// XXX The DiscordUserMap class will open and close the file each time it saves the map, so it will eventually use this one
		if (err) {
			// Well, this is bad...
			console.error("Could not move discord user map");
		}
	});

	// Remove it from the settings
	delete settings.discord.usersfile;
}

// Set whether or not emojis should be sent with their stickers
if (settings.telegram.sendEmojiWithStickers === undefined) {
	settings.telegram.sendEmojiWithStickers = true;
}

/**************************************
 * Write it back to the settings file *
 **************************************/

try {
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, "\t"));
} catch (err) {
	console.error("Could not save changes to the settings!");
}

/*******************************************************
 * Read environment variables into the settings object *
 *******************************************************/

// These should never be written into the settings file, to not leak secrets. They must therefore come after the writing

if (settings.telegram.auth.token === "env") {
	settings.telegram.auth.token = process.env.TELEGRAM_BOT_TOKEN;
}
if (settings.discord.auth.token === "env") {
	settings.discord.auth.token = process.env.DISCORD_BOT_TOKEN;
}

/******************************
 * Export the settings object *
 ******************************/

module.exports = settings;
