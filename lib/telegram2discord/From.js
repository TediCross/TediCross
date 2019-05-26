"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");

/**********************
 * The From functions *
 **********************/

/**
 * Information about the sender of a Telegram message
 *
 * @typedef {Object} From
 * @prop {String} firstName	First name of the sender
 * @prop {String} lastName	Last name of the sender
 * @param {String} username	Username of the sender
 */

/**
 * Creates a new From object
 *
 * @param {String} firstName	First name of the sender
 * @param {String} [lastName]	Last name of the sender
 * @param {String} [username]	Username of the sender
 *
 * @returns {From}	The From object
 *
 * @memberof From
 */
function createFromObj(firstName, lastName, username) {
	return {
		firstName,
		lastName,
		username
	};
}

/**
 * Makes a display name out of a from object
 *
 * @param {Boolean} useFirstNameInsteadOfUsername	Whether or not to always use the first name instead of the username
 * @param {From} from	The from object
 *
 * @returns {String}	The display name
 *
 * @memberof From
 */
function makeDisplayName(useFirstNameInsteadOfUsername, from) {
	return R.ifElse(
		from => useFirstNameInsteadOfUsername || R.isNil(from.username),
		R.prop("firstName"),
		R.prop("username")
	)(from);
}

/***************
 * Export them *
 ***************/

module.exports = {
	createFromObj,
	makeDisplayName
};
