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
 * Creates a new From object from a Telegram message
 *
 * @param {Object} message	The Telegram message to create the from object from
 *
 * @returns {From}	The from object
 */
function createFromObjFromMessage(message) {
	return R.ifElse(
		// Check if the `from` object exists
		R.compose(R.isNil, R.prop("from")),
		// This message is from a channel
		message => createFromObj(message.chat.title),
		// This message is from a user
		R.compose(
			createFromObjFromUser,
			R.prop("from")
		)
	)(message);
}

/**
 * Creates a new From object from a Telegram User object
 *
 * @param {Object} user	The Telegram user object to create the from object from
 *
 * @returns {From}	The From object created from the user
 */
function createFromObjFromUser(user) {
	return createFromObj(user.first_name, user.last_name, user.username);
}

/**
 * Creates a From object from a Telegram chat object
 *
 * @param {Object} chat	The Telegram chat object to create the from object from
 *
 * @returns {From}	The From object created from the chat
 */
function createFromObjFromChat(chat) {
	return createFromObj(chat.title);
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
	createFromObjFromMessage,
	createFromObjFromUser,
	createFromObjFromChat,
	makeDisplayName
};
