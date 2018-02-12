"use strict";

/**************************
 * Import important stuff *
 **************************/

const Logger = require("./Logger");

/************************
 * The Application data *
 ************************/

// XXX This object used to have many more responsibilities. It is now being phased out

/**
 * Object containing application-wide stuff
 *
 * @prop {Logger} logger	The application's logger
 */
const Application = {
	logger: new Logger()
};

/*********************
 * Export the object *
 *********************/

module.exports = Application;
