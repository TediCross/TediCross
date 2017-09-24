"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const path = require("path");

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

// Make the Telegram chat ID into an integer
if (settings.telegram.chatID !== "TELEGRAM CHAT ID HERE") {
	settings.telegram.chatID = Number.parseInt(settings.telegram.chatID);
}

// TODO Do this with lodash's _.default() or something

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

/**************************************
 * Write it back to the settings file *
 **************************************/

fs.writeFile(settingsPath, JSON.stringify(settings, null, "\t"), (err) => {
	if (err) {
		console.error("Could not save changes to the settings!");
	}
});

/******************************
 * Export the settings object *
 ******************************/

module.exports = settings;
