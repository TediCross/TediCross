"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");

/**************************
 * Read the settings file *
 **************************/

const settings = JSON.parse(fs.readFileSync("settings.json"));

// Set default debug value
if (settings.debug === undefined) {
	console.log("No debug setting found in settings. Setting it to false. Refer to the example settings file");
	settings.debug = false;
}

// Set the default name settings
if (settings.telegram.useFirstNameInsteadOfUsername === undefined) {
	console.log("Could not figure out if usernames or first names should be sent. Using usernames. See the \"telegram.useFirstNameInsteadOfUsername\" setting");
	settings.telegram.useFirstNameInsteadOfUsername = false;
}

// Set default colon values
if (settings.telegram.colonAfterSenderName === undefined) {
	console.log("Could not figure out if usernames should be postfixed with colon in Telegram. Setting to 'false'. See the \"telegram.colonAfterSenderName\" setting");
	settings.telegram.colonAfterSenderName = false;
}

// Set default skipOldMessages values
if (settings.telegram.skipOldMessages === undefined) {
	console.log("Could not figure out if old messages from telegram should be skipped. Setting to 'true'. See the \"telegram.skipOldMessages\" setting");
	settings.telegram.skipOldMessages = true;
}

/******************************
 * Export the settings object *
 ******************************/

module.exports = settings;
