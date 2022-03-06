import { MessageEmbed } from "discord.js";
import { md2html } from "./md2html";

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
export function handleEmbed(embed: MessageEmbed, senderName: string) {
	// Construct the text to send
	let text = `<b>${senderName}</b>\n`;

	// Handle the title
	if (embed.title !== undefined) {
		const hasUrl = embed.url !== undefined;
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
	if (embed.description !== undefined) {
		text += md2html(embed.description!) + "\n";
	}

	// Handle the fields
	embed.fields.forEach(field => {
		text += `\n<b>${field.name}</b>\n` + md2html(field.value) + "\n";
	});

	// Handle the author part
	if (embed.author !== null) {
		text += "\n<b>Author</b>\n" + embed.author.name + "\n";
	}

	// All done!
	return text;
}
