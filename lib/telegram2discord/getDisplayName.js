"use strict";

/**************************
 * Import important stuff *
 **************************/

const settings = require("../settings");

/**
 * Gets the display name of a user
 *
 * @param {Object} user	A user object
 *
 * @return {String}	The user's display name
 */
function getDisplayName(user) {
	// Default to using username
	let displayName = user.username;

	// Check whether or not to use names instead (or if the username does not exist
	if (!displayName || settings.telegram.useFirstNameInsteadOfUsername) {
		displayName = user.first_name;
	}

	return displayName;
}

/***********************
 * Export the function *
 ***********************/

module.exports = getDisplayName;
