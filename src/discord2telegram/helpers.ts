import R from "ramda";
import { TelegramSettings } from "../settings/TelegramSettings";

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

/**
 * Map of common Discord custom emoji names to their Unicode equivalents
 */
const emojiMap: { [key: string]: string } = {
	'sol': '🌞',  // Solana
	'photon': '⚡',  // Photon
	'dexnotpaid': '💱',  // Generic exchange symbol
	// Add more mappings as needed
};

/**
 * Replaces Discord custom emojis with their Unicode equivalents or removes them
 *
 * @param input The string that needs to be processed
 * @param settings The Telegram settings object containing the emoji map
 *
 * @returns Processed string
 */
export function replaceDiscordEmojis(input: string, settings: TelegramSettings) {
	// First unescape the HTML entities since we're working with the processed text
	input = input.replace(/&lt;:([^:]+):(\d+)&gt;/g, (match, emojiName) => {
		// If we have a mapping for this emoji, use it
		if (settings.emojiMap[emojiName]) {
			return settings.emojiMap[emojiName];
		}
		// If no mapping exists, return original input
		return input;
	});
	return input;
}

function htmlCleanup(input: string, settings: TelegramSettings) {
	// Replace Discord custom emojis first
	input = replaceDiscordEmojis(input, settings);

	if (settings.useCustomEmojiFilter) {
		input = removeCustomEmojis(input);
	}

	if (settings.replaceAtWithHash) {
		input = replaceAtWith(input, "#");
	}

	if (settings.replaceExcessiveSpaces) {
		input = replaceExcessiveSpaces(input);
	}
	return input;
}
