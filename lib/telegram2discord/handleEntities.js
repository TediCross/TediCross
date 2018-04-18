"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/*****************************
 * Define the entity handler *
 *****************************/

/**
 * Converts entities (usernames, code, ...) in Telegram messages to Discord format
 *
 * @param {DiscordUserMap} dcUsers	A map between discord users and their IDs
 * @param {String} text	The text to handle
 * @param {MessageEntity[]} entities	Array of entities for the text
 *
 * @return {String} The fully converted string
 */
function handleEntities(dcUsers, text, entities = []) {
	// Don't mess up the original
	const substitutedText = text !== undefined ? text.split("") : [""];

	// Markdown links to put on the message
	const markdownLinks = [];

	// Iterate over the entities backwards, to not fuck up the offset
	for (let i = entities.length-1; i >= 0; i--) {

		// Select the entity object
		const e = entities[i];

		// Extract the entity part
		const part = text.substring(e.offset, e.offset+e.length);

		// The string to substitute
		let substitute = part;

		// Do something based on entity type
		switch (e.type) {
			case "mention":
			case "text_mention": {
				// A mention. Substitute the Discord user ID if one exists
				const username = part.substring(1);
				substitute = dcUsers.lookupUsername(username) ? `<@${dcUsers.lookupUsername(username)}>` : part;
				break;
			}
			case "code":
				// Inline code. Add backticks
				substitute = "`" + part + "`";
				break;
			case "pre":
				// Code block. Add triple backticks
				substitute = "```\n" + part + "\n```";
				break;
			case "text_link":
				// Markdown style link. 'part' is the text, 'e.url' is the URL
				// substitute = "[" + part + "](" + e.url + ")";
				// Discord appears to not be able to handle this type of links. Make the substitution an object which can be found and properly substituted later
				markdownLinks.unshift(e.url);
				substitute = {
					type: "mdlink",
					text: part
				};
				break;
			case "bold":
				// Bold text
				substitute = "**" + part + "**";
				break;
			case "italic":
				// Italic text
				substitute = "*" + part + "*";
				break;
			case "hashtag":
			case "url":
			case "bot_command":
			case "email":
			default:
				// Just leave it as it is
				break;
		}

		// Do the substitution if there is a change
		if (substitute !== part) {
			substitutedText.splice(e.offset, e.length, substitute);
		}
	}

	// Put the markdown links on the end, if there are any
	if (markdownLinks.length > 0) {
		substitutedText.push("\n\n");
		for (let i = 0; i < markdownLinks.length; i++) {
			// Find out where the corresponding text is
			const index = substitutedText.findIndex((e) => e instanceof Object && e.type === "mdlink");
			const obj = substitutedText[index];

			// Replace the object with the proper text and reference
			substitutedText[index] = `${obj.text}[${i+1}]`;

			// Push the link to the end
			substitutedText.push(`[${i+1}]: ${markdownLinks[i]}\n`);
		}
	}

	// Return the converted string
	return substitutedText.join("");
}

/***********************
 * Export the function *
 ***********************/

module.exports = handleEntities;
