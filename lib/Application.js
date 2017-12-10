"use strict";

/**************************
 * Import important stuff *
 **************************/

const ChatMap = require("./ChatMap");
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
	chats: new ChatMap(settings.chatMap),
	logger: new Logger()
};

/*********************
 * Export the object *
 *********************/

module.exports = Application;
