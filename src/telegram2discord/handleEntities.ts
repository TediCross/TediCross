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
	let hasLinks = false;

	// NOTE new version
	const tagsArray: string[] = [];
	let skipIndex: number[] = [];
	let firstLink = true;
	let onlyOneLink = false;
	const regExpCaret = /(\r\n|\r|\n)$/i;
	for (const e of entities) {
		let beginIndex = e.offset;
		const part = text.substring(beginIndex, e.offset + e.length);
		let endIndex = e.offset + part.trim().length;
		let prefix = tagsArray[beginIndex] || "";
		let suffix = tagsArray[endIndex] || "";

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
						tagsArray[beginIndex + 1] = `${prefix}<@${dcUser.id}>`;
					} else if (!R.isNil(dcRole)) {
						tagsArray[beginIndex + 1] = `${prefix}<@&${dcRole.id}>`;
					} else {
						tagsArray[beginIndex + 1] = `${part}`;
					}
					skipIndex = skipIndex.concat(
						Array(e.length)
							.fill(1)
							.map((element, index) => index + beginIndex)
					);
				} catch (err: any) {
					console.error(
						`Could not process a mention for Discord channel ${bridge.discord.channelId} on bridge ${bridge.name}: ${err.message}`
					);
				}
				break;
			}
			case "code": {
				// Inline code. Add backticks
				tagsArray[beginIndex] = prefix + "`";
				tagsArray[endIndex] = "`" + suffix;
				break;
			}
			case "pre": {
				// Code block. Add triple backticks
				tagsArray[beginIndex] = prefix + "```\n";
				tagsArray[endIndex] = "\n```" + suffix;
				break;
			}
			case "url":
			case "text_link": {
				// hard fix
				if (part.indexOf(" ") === 0) {
					beginIndex++;
					endIndex++;
					prefix = "";
				}

				const urlStr = ((e as any).url || part).trim();

				if (part.trim() === urlStr) {
					skipIndex = skipIndex.concat(
						Array(e.length)
							.fill(1)
							.map((element, index) => index + beginIndex)
					);
					tagsArray[beginIndex] = prefix + "[link";
					if (regExpCaret.test(part)) {
						suffix += "\n";
					}
				} else {
					tagsArray[beginIndex] = prefix + "[";
				}

				if (firstLink) {
					tagsArray[endIndex] = `](${urlStr})` + suffix;
					firstLink = false;
					onlyOneLink = true;
				} else {
					tagsArray[endIndex] = `](<${urlStr}>)` + suffix;
					onlyOneLink = false;
				}
				hasLinks = bridge.discord.useEmbeds !== "never";
				break;
			}
			case "bold": {
				// Bold text
				tagsArray[beginIndex] = prefix + "**";
				tagsArray[endIndex] = "**" + suffix;
				break;
			}
			case "italic": {
				// Italic text
				// parse italic only if no other tags were there
				if (!prefix) {
					tagsArray[beginIndex] = prefix + "*";
					if (regExpCaret.test(part)) {
						tagsArray[endIndex - 1] = "*";
					} else {
						tagsArray[endIndex] = "*" + suffix;
					}
				}
				break;
			}
			case "strikethrough": {
				// strikethrough text
				tagsArray[beginIndex] = prefix + "~~";
				tagsArray[endIndex] = "~~" + suffix;
				break;
			}
			case "underline": {
				// Underlined text
				tagsArray[beginIndex] = prefix + "__";
				tagsArray[endIndex] = "__" + suffix;
				break;
			}
			case "spoiler": {
				// Spoiler text
				tagsArray[beginIndex] = prefix + "||";
				tagsArray[endIndex] = "||" + suffix;
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
						tagsArray[beginIndex] = prefix + `<#${mentionedChannel.id}>`;
					} else {
						tagsArray[beginIndex] = `${part}`;
					}
					skipIndex = skipIndex.concat(
						Array(e.length)
							.fill(1)
							.map((element, index) => index + beginIndex)
					);
				} catch (err: any) {
					console.error(
						`Could not process a hashtag for Discord channel ${bridge.discord.channelId} on bridge ${bridge.name}: ${err.message}`
					);
				}
				break;
			}
			case "bot_command":
			case "email":
			default: {
				// Just leave it as it is
				break;
			}
		}
	}
	// If  there is only one link, then we don't want to use Embeds - to let Discord generate a preview
	if (onlyOneLink) {
		hasLinks = false;
	}

	if (bridge.discord.useEmbeds === "always") {
		hasLinks = true;
	}

	// add tags to source text
	const finalTextArray: string[] = [];
	const length = tagsArray.length > text.length ? tagsArray.length : text.length;
	for (let i = 0; i < length; i++) {
		const repText = skipIndex.includes(i) ? "" : text[i] || "";
		finalTextArray[i] = `${tagsArray[i] || ""}${repText}`;
	}

	// Return the converted/combined string
	return [finalTextArray.join(""), hasLinks];
}
