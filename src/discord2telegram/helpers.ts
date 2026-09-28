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

/** Extract readable text and image URLs from Discord's nested message components. */
export function extractComponentContent(components: any[] = []) {
	const text: string[] = [];
	const imageUrls: string[] = [];
	const visit = (component: any) => {
		const value = typeof component?.toJSON === "function" ? component.toJSON() : component;
		if (!value || typeof value !== "object") return;
		if (typeof value.content === "string" && value.content.trim()) text.push(value.content.trim());
		if (typeof value.label === "string" && value.label.trim()) text.push(value.label.trim());
		if (typeof value.description === "string" && value.description.trim()) text.push(value.description.trim());
		const media = value.media?.url ?? value.media?.proxy_url;
		if (typeof media === "string" && /^https?:\/\//i.test(media)) imageUrls.push(media);
		for (const item of value.items ?? []) {
			const itemUrl = item?.media?.url ?? item?.media?.proxy_url;
			if (typeof itemUrl === "string" && /^https?:\/\//i.test(itemUrl)) imageUrls.push(itemUrl);
		}
		for (const child of value.components ?? []) visit(child);
	};
	components.forEach(visit);
	return { text: [...new Set(text)], imageUrls: [...new Set(imageUrls)] };
}

/** Returns Telegram reply options only when a mapped message exists. */
export function telegramReplyOptions(replyId: string | undefined) {
	if (!replyId || replyId === "0") return {};
	const messageId = Number(replyId);
	return Number.isSafeInteger(messageId) && messageId > 0 ? { reply_parameters: { message_id: messageId } } : {};
}

export function getDiscordDisplayName(member: any, author: any, useNickname: boolean) {
	if (useNickname && member?.displayName) return member.displayName;
	return author?.globalName || author?.username || member?.displayName || "Unknown user";
}
