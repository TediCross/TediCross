import R from "ramda";

/**
 * Ignores errors arising from trying to delete an already deleted message. Rethrows other errors
 *
 * @param err The error to check
 *
 * @throws The error, if it is another type
 */
export const ignoreAlreadyDeletedError = R.ifElse(
	R.propEq("description", "Bad Request: message to delete not found"),
	R.always(undefined),
	err => {
		throw err;
	}
);

/**
 * Deletes a Telegram message
 *
 * @param ctx The Telegraf context to use
 * @param message The message to delete
 *
 * @returns Promise resolving when the message is deleted
 */
export const deleteMessage = R.curry((ctx, { chat, message_id }) => ctx.telegram.deleteMessage(chat.id, message_id));
