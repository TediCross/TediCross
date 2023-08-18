import R from "ramda";
import { Message, User } from "telegraf/typings/core/types/typegram";

/**********************
 * The From functions *
 **********************/

interface From {
	firstName: string;
	lastName?: string;
	username?: string;
}

/**
 * Creates a new From object
 *
 * @param firstName First name of the sender
 * @param [lastName] Last name of the sender
 * @param [username] Username of the sender
 *
 * @returns {From}	The From object
 *
 * @memberof From
 */
export function createFromObj(firstName: string, lastName: string | undefined, username: string | undefined): From {
	return {
		firstName,
		lastName,
		username
	};
}

/**
 * Creates a new From object from a Telegram message
 *
 * @param message The Telegram message to create the from object from
 *
 * @returns The from object
 */
export function createFromObjFromMessage(message: Message) {
	return R.ifElse<any, any, any>(
		// Check if the `from` object exists
		R.compose(R.isNil, R.prop("from")),
		// This message is from a channel
		message => createFromObj(message.chat.title, "", ""),
		// This message is from a user
		R.compose(createFromObjFromUser, R.prop("from") as any)
	)(message);
}

/**
 * Creates a new From object from a Telegram User object
 *
 * @param user The Telegram user object to create the from object from
 *
 * @returns The From object created from the user
 */
export function createFromObjFromUser(user: User) {
	return createFromObj(user.first_name, user.last_name || "", user.username || "");
}

/**
 * Creates a From object from a Telegram chat object
 *
 * @param chat The Telegram chat object to create the from object from
 *
 * @returns The From object created from the chat
 */
export function createFromObjFromChat(chat: Record<string, any>) {
	return createFromObj(chat.title, "", "");
}

/**
 * Makes a display name out of a from object
 *
 * @param useFirstNameInsteadOfUsername Whether or not to always use the first name instead of the username
 * @param from The from object
 *
 * @returns The display name
 */
export function makeDisplayName(useFirstNameInsteadOfUsername: boolean, from: From) {
	if (useFirstNameInsteadOfUsername || !from.username) {
		const suffix: string = from.lastName ? ` ${from.lastName}` : "";
		return `${from.firstName}${suffix}`;
	}

	return from.username;
	// return R.ifElse<any, any, any>(
	// 	from => R.isNil(from.username) || useFirstNameInsteadOfUsername,
	// 	// (useFirstNameInsteadOfUsername || R.isNil(from.username)),
	// 	from => R.prop("firstName", from),
	// 	from => R.prop("username", from)
	// )(from);
}
