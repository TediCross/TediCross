"use strict";

/**
 * Gets the display name of a user
 *
 * @param {Object} user	A user object
 *
 * @return {String}	The user's display name
 */
function getDisplayName(user) {
	return user.username || user.first_name;
}

/***********************
 * Export the function *
 ***********************/

module.exports = getDisplayName;
