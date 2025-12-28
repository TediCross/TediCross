import { Embed } from "discord.js";
import { md2html } from "./md2html";
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
	let text = "";
	
	// Only add sender name if provided (for backward compatibility)
	if (senderName) {
		text = `<b>${senderName}</b>\n`;
	}

	// Handle the title
	if (embed.title !== undefined && embed.title !== null) {
		const hasUrl = embed.url !== undefined && embed.url !== null;
		if (hasUrl) {
			text += `<a href="${embed.url}">`;
		}
		text += embed.title;
		if (hasUrl) {
			text += "</a>";
		}
		text += "\n";
	}

	// Handle the description
	if (embed.description !== undefined && embed.description !== null && embed.description.trim() !== "") {
		text += md2html(embed.description, settings);
	}

	// Handle the fields
	if (embed.fields && embed.fields.length > 0) {
		embed.fields.forEach(field => {
			if (field.name && field.value) {
				text += field.name ? `\n<b>${field.name}</b>\n` : "\n";
				text += md2html(field.value, settings);
			}
		});
	}

	// Handle the author part
	if (embed.author !== null && embed.author?.name) {
		text += text.length > 0 ? "\n\n<b>Author</b>\n" : "<b>Author</b>\n";
		text += embed.author.name;
	}

	// All done!
	return text;
}
