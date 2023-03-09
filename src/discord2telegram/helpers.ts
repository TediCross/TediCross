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
