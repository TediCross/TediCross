import R from "ramda";
import { Message, User } from "telegraf/typings/core/types/typegram";

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

interface From {
	firstName: string;
	lastName: string;
	username: string;
}

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
export function createFromObj(firstName: string, lastName: string, username: string): From {
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
export function createFromObjFromMessage(message: Message) {
	return R.ifElse<any, any, any>(
		// Check if the `from` object exists
		R.compose(R.isNil, R.prop("from")),
		// This message is from a channel
		message => createFromObj(message.chat.title, "", ""),
		// This message is from a user
		R.compose(
			createFromObjFromUser,
			R.prop("from") as any
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
export function createFromObjFromUser(user: User) {
	return createFromObj(user.first_name, user.last_name || "", user.username || "");
}

/**
 * Creates a From object from a Telegram chat object
 *
 * @param {Object} chat	The Telegram chat object to create the from object from
 *
 * @returns {From}	The From object created from the chat
 */
export function createFromObjFromChat(chat: Record<string, any>) {
	return createFromObj(chat.title, "", "");
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
export function makeDisplayName(useFirstNameInsteadOfUsername: boolean, from: From) {
	return R.ifElse(
		from => useFirstNameInsteadOfUsername || R.isNil(from.username),
		R.prop("firstName"),
		R.prop("username")
	)(from);
}
