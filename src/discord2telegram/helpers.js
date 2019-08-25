"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");

/********************
 * Make the helpers *
 ********************/

/**
 * Ignores errors arising from trying to delete an already deleted message. Rethrows other errors
 *
 * @param {Error} err   The error to check
 *
 * @returns {undefined}
 *
 * @throws {Error}      The error, if it is another type
 */
const ignoreAlreadyDeletedError = R.ifElse(
	R.propEq("message", "Unknown Message"),
	R.always(undefined),
	err => {throw err;}
);

/***************
 * Export them *
 ***************/

module.exports = {
	ignoreAlreadyDeletedError
};
