"use strict";

/**************************
 * Import important stuff *
 **************************/

const BridgeMap = require("./BridgeMap");
const Logger = require("./Logger");
const settings = require("./settings");

/************************
 * The Application data *
 ************************/

/**
 * Object containing application-wide stuff
 *
 * @prop {Object} settings	Settings of the application
 * @prop {BridgeMap} bridge Map of telegram chats and discord channels
 * @prop {Logger} logger	The application's logger
 */
const Application = {
	settings,
	bridge: new BridgeMap(settings.bridgeMap),
	logger: new Logger()
};

/*********************
 * Export the object *
 *********************/

module.exports = Application;
