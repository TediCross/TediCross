import R from "ramda";

/********************
 * Make the helpers *
 ********************/

/**
 * Ignores errors arising from trying to delete an already deleted message. Rethrows other errors
 *
 * @param err The error to check
 *
 * @throws The error, if it is another type
 */
export const ignoreAlreadyDeletedError = R.ifElse(R.propEq("message", "Unknown Message"), R.always(undefined), err => {
	throw err;
});

/**
 * Converts characters '&', '<' and '>' in strings into HTML safe strings
 *
 * @param text The text to escape the characters in
 *
 * @returns The escaped string
 */
export const escapeHTMLSpecialChars = R.compose(
	R.replace(/>/g, "&gt;"),
	R.replace(/</g, "&lt;"),
	R.replace(/&/g, "&amp;")
);

/**
 * Filters custom emojis from the output
 *
 * @param input The string that needs to be filtered
 *
 * @returns Filtered string
 */
export function removeCustomEmojis(input: string) {
	const regex = /&lt;[^;]*&gt;\s?/gi;
	return input.split(regex).join("");
}

/**
 * Replaces custom emojis with a definable custom string
 *
 * @param input The string that needs to be processed
 * @param replacement The string that will be used as a replacement for custom emojis
 *
 * @returns Filtered string
 */
export function replaceCustomEmojis(input: string, replacement: string) {
	const regex = /&lt;[^;]*&gt;/g;
	return input.replace(regex, replacement);
}

/**
 * Replaces @ with # to prevent unneeded references in Telegram
 *
 * @param input The string that needs to be processed
 * @param replacement The string that will be used as a replacement for @ in the output
 *
 * @returns Processed string
 */
export function replaceAtWith(input: string, replacement: string) {
	const regex = /@/g;
	return input.replace(regex, replacement);
}

/**
 * Replaces excessive (two or more) whitespaces with a single one
 *
 * @param input The string that needs to be processed
 *
 * @returns Processed string
 */
export function replaceExcessiveSpaces(input: string) {
	const regex = /[^\S\n]{2,}/g;
	return input.replace(regex, "");
}
