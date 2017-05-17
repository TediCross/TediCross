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

/******************************
 * Export the settings object *
 ******************************/

module.exports = settings;
