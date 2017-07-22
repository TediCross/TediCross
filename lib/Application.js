"use strict";

/**************************
 * Import important stuff *
 **************************/

const Logger = require("./Logger");

const settings = require("./settings");

/************************
 * The Application data *
 ************************/

/**
 * Object containing application-wide stuff
 *
 * @prop {Object} settings	Settings of the application
 * @prop {Logger} logger	The application's logger
 */
const Application = {
	settings,
	logger: new Logger()
};

/*********************
 * Export the object *
 *********************/

module.exports = Application;
