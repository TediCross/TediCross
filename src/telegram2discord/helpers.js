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
 * @param {Error} err	The error to check
 *
 * @returns {undefined}
 *
 * @throws {Error}	The error, if it is another type
 */
const ignoreAlreadyDeletedError = R.ifElse(
	R.propEq("description", "Bad Request: message to delete not found"),
	R.always(undefined),
	err => {
		throw err;
	}
);

/**
 * Deletes a Telegram message
 *
 * @param {Context} ctx	The Telegraf context to use
 * @param {Object} message	The message to delete
 *
 * @returns {Promise}	Promise resolving when the message is deleted
 */
const deleteMessage = R.curry((ctx, { chat, message_id }) => ctx.telegram.deleteMessage(chat.id, message_id));

/***************
 * Export them *
 ***************/

module.exports = {
	ignoreAlreadyDeletedError,
	deleteMessage
};
