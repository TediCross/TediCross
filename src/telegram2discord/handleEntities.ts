import { Client } from "discord.js";
import R from "ramda";
import { MessageEntity } from "telegraf/typings/core/types/typegram";
import { Bridge } from "../bridgestuff/Bridge";
import { fetchDiscordChannel } from "../fetchDiscordChannel";

/*********************
 * Make some helpers *
 *********************/

//@ts-ignore
const findFn = (prop: string, regexp: RegExp) => R.compose(R.not, R.isEmpty, R.match(regexp), R.prop(prop));

/*****************************
 * Define the entity handler *
 *****************************/

/**
 * Converts entities (usernames, code, ...) in Telegram messages to Discord format
 *
 * @param text The text to handle
 * @param entities Array of entities for the text
 * @param dcBot The Discord bot
 * @param bridge The bridge this message is crossing
 *
 * @return The fully converted string
 */
export async function handleEntities(text: string, entities: MessageEntity[], dcBot: Client, bridge: Bridge) {
	// Don't mess up the original
	const substitutedText = text !== undefined ? text.split("") : [""];

	// Markdown links to put on the message
	const markdownLinks = [];

	// Make sure messages without entities don't crash the thing
	if (!Array.isArray(entities)) {
		entities = [];
	}

	// Iterate over the entities backwards, to not fuck up the offset
	for (let i = entities.length - 1; i >= 0; i--) {
		// Select the entity object
		const e = entities[i];

		// Extract the entity part
		const part = text.substring(e.offset, e.offset + e.length);

		// The string to substitute
		let substitute = part as string | Record<string, string>;

		// Do something based on entity type
		switch (e.type) {
			case "mention":
			case "text_mention": {
				try {
					// A mention. Substitute the Discord user ID or Discord role ID if one exists
					// XXX Telegram considers it a mention if it is a valid Telegram username, not necessarily taken. This means the mention matches the regexp /^@[a-zA-Z0-9_]{5,}$/
					// In turn, this means short usernames and roles in Discord, like '@devs', will not be possible to mention
					const channel = await fetchDiscordChannel(dcBot, bridge);
					const mentionable = new RegExp(`^${part.substring(1)}$`, "i");
					const dcUser = channel.members.find(findFn("displayName", mentionable));
					// XXX Could not find a way to actually search for roles. Looking in the cache will mostly work, but I don't think it is guaranteed
					const dcRole = channel.guild.roles.cache.find(findFn("name", mentionable));

					if (!R.isNil(dcUser)) {
						substitute = `<@${dcUser.id}>`;
					} else if (!R.isNil(dcRole)) {
						substitute = `<@&${dcRole.id}>`;
					} // else handled by the default substitute value
				} catch (err: any) {
					console.error(
						`Could not process a mention for Discord channel ${bridge.discord.channelId} on bridge ${bridge.name}: ${err.message}`
					);
				}
				break;
			}
			case "code": {
				// Inline code. Add backticks
				substitute = "`" + part + "`";
				break;
			}
			case "pre": {
				// Code block. Add triple backticks
				substitute = "```\n" + part + "\n```";
				break;
			}
			case "text_link": {
				// Markdown style link. 'part' is the text, 'e.url' is the URL
				// substitute = "[" + part + "](" + e.url + ")";
				// Discord appears to not be able to handle this type of links. Make the substitution an object which can be found and properly substituted later
				markdownLinks.unshift(e.url);
				substitute = {
					type: "mdlink",
					text: part
				};
				break;
			}
			case "bold": {
				// Bold text
				substitute = "**" + part + "**";
				break;
			}
			case "italic": {
				// Italic text
				substitute = "*" + part + "*";
				break;
			}
			case "underline": {
				// Underlined text
				substitute = "__" + part + "__";
				break;
			}
			case "spoiler": {
				// Spoiler text
				substitute = "||" + part + "||";
				break;
			}
			case "hashtag": {
				try {
					// Possible name of a Discord channel on the same Discord server
					const channelName = new RegExp(`^${part.substring(1)}$`);

					// Find out if this is a channel on the bridged Discord server
					const channel = await fetchDiscordChannel(dcBot, bridge);
					// XXX Could not find a way to actually search for channels. Looking in the cache will mostly work, but I don't think it is guaranteed
					const mentionedChannel = channel.guild.channels.cache.find(findFn("name", channelName));

					// Make Discord recognize it as a channel mention
					if (!R.isNil(mentionedChannel)) {
						substitute = `<#${mentionedChannel.id}>`;
					}
				} catch (err: any) {
					console.error(
						`Could not process a hashtag for Discord channel ${bridge.discord.channelId} on bridge ${bridge.name}: ${err.message}`
					);
				}
				break;
			}
			case "url":
			case "bot_command":
			case "email":
			default: {
				// Just leave it as it is
				break;
			}
		}

		// Do the substitution if there is a change
		if (substitute !== part) {
			substitutedText.splice(e.offset, e.length, substitute as string);
		}
	}

	// Put the markdown links on the end, if there are any
	if (!R.isEmpty(markdownLinks)) {
		substitutedText.push("\n\n");
		for (let i = 0; i < markdownLinks.length; i++) {
			// Find out where the corresponding text is
			const index = substitutedText.findIndex((e: any) => e instanceof Object && e.type === "mdlink");
			const obj = substitutedText[index];

			// Replace the object with the proper text and reference
			//@ts-ignore
			substitutedText[index] = `${obj.text}[${i + 1}]`;

			// Push the link to the end
			substitutedText.push(`[${i + 1}]: ${markdownLinks[i]}\n`);
		}
	}

	// Return the converted string
	return substitutedText.join("");
}
