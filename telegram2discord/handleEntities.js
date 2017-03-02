"use strict";

/**************************
 * Import important stuff *
 **************************/

const settings = require("../settings");
const DiscordUserMap = require("../discord2telegram/DiscordUserMap");

// Get the instance of the DiscordUserMap
const dcUsers = DiscordUserMap.getInstance(settings.discord.usersfile);

/**
 * Converts entities (usernames, code, ...) in Telegram messages to Discord format
 *
 * @param {String} text	The text to handle
 * @param {MessageEntity[]} entities	Array of entities for the text
 *
 * ®return {String} The fully converted string
 */
function handleEntities(text, entities = []) {
	// Don't mess up the original
	let substitutedText = text !== undefined ? text.split("") : [""];

	// Iterate over the entities backwards, to not fuck up the offset
	for (let i = entities.length-1; i >= 0; i--) {

		// Select the entity object
		let e = entities[i];

		// Extract the entity part
		let part = text.substring(e.offset, e.offset+e.length);

		// The string to substitute
		let substitute = part;

		// Do something based on entity type
		switch(e.type) {
			case "mention":
			case "text_mention":
				// A mention. Substitute the Discord user ID if one exists
				let username = part.substring(1);
				substitute = dcUsers.lookupUsername(username) ? `<@${dcUsers.lookupUsername(username)}>` : part;
				break;
			case "code":
				// Inline code. Add backticks
				substitute = "`" + part + "`";
				break;
			case "pre":
				// Code block. Add triple backticks
				substitute = "```\n" + part + "\n```";
				break;
			case "hashtag":
			case "url":
			case "bot_command":
			case "email":
			case "bold":
			case "italic":
			case "text_link":
			default:
				// Just leave it as it is
				break;
		}

		// Do the substitution if there is a change
		if (substitute !== part) {
			substitutedText.splice(e.offset, e.length, substitute);
		}
	}

	// Return the converted string
	return substitutedText.join("");
}

/***********************
 * Export the function *
 ***********************/

module.exports = handleEntities;
