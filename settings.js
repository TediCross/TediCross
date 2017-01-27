"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");

/**************************
 * Read the settings file *
 **************************/

const settings = JSON.parse(fs.readFileSync("settings.json"));

/******************************
 * Export the settings object *
 ******************************/

module.exports = settings;
