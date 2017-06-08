"use strict";

/**
 * Parse Discord's Markdown format to Telegram-accepted HTML
 *
 * @param {String} str	The markdown string to convert
 *
 * @return {String}	Telegram-friendly HTML
 */
function md2html(str) {
	return str
	  .replace(/&/g, "&amp;")	// This and the two next makes HTML the user inputs harmless
	  .replace(/</g, "&lt;")
	  .replace(/>/g, "&gt;")
	  .replace(/```\S+\n/g, "```")	// Ignore the language of code blocks. Telegram can't really do anything with that info
	  .replace(/```((.|\s)+?)```/g, (match, code) => `<pre>${code}</pre>`)
	  .replace(/`([^`]+)`/g, (match, code) => `<code>${code}</code>`)
	  .replace(/\*\*(.*?)\*\*/g, (match, text) => `<b>${text}</b>`)
	  .replace(/__(.*?)__/g, (match, text) => `<b>${text}</b>`)	// Telegram doesn't support '<u>', so make it bold instead
	  .replace(/\*(.*?)\*/g, (match, text) => `<i>${text}</i>`)
	  .replace(/_(.*?)_/g, (match, text) => `<i>${text}</i>`)
	  .trim();
}

/***********************
 * Export the function *
 ***********************/

module.exports = md2html;
