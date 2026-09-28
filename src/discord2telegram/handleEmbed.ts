import { Embed } from "discord.js";
import { md2html } from "./md2html";
import { escapeHTMLSpecialChars } from "./helpers";
import { TelegramSettings } from "../settings/TelegramSettings";

/****************************
 * The handleEmbed function *
 ****************************/

/**
 * Takes an embed and converts it to text which Telegram likes
 *
 * @param embed The embed to process
 * @param senderName Name of the sender of the embed
 *
 * @returns A string ready to send to Telegram
 */
export function handleEmbed(embed: Embed, senderName: string, settings: TelegramSettings) {
	// Construct the text to send
	let text = senderName ? `<b>${escapeHTMLSpecialChars(senderName)}</b>\n` : "";

	// Handle the title
	if (embed.title !== null && embed.title !== undefined) {
		const hasUrl = embed.url !== null && embed.url !== undefined;
		if (hasUrl) {
			text += `<a href="${escapeHTMLSpecialChars(embed.url).replace(/"/g, "&quot;")}">`;
		}
		text += escapeHTMLSpecialChars(embed.title);
		if (hasUrl) {
			text += "</a>";
		}
		text += "\n";
	}

	// Handle the description
	if (embed.description !== null && embed.description !== undefined) {
		text += md2html(embed.description, settings) + "\n";
	}

	// Handle the fields
	embed.fields.forEach(field => {
		text += `\n<b>${escapeHTMLSpecialChars(field.name)}</b>\n` + md2html(field.value, settings) + "\n";
	});

	// Handle the author part
	if (embed.author?.name) {
		text += "\n<b>Author</b>\n" + escapeHTMLSpecialChars(embed.author.name) + "\n";
	}

	// All done!
	return text;
}
