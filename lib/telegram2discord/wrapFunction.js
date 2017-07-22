"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");

/**
 * Wraps a function taking a message as a parameter so that the message is ignored if it is from the wrong chat
 *
 * @param {Function} func	The function to wrap. Must take a message as its parameter
 * @param {BotAPI} tgBot	The Telegram bot
 *
 * @return {Function}	A function taking a message
 */
function wrapFunction(func, tgBot) {
	return function(message) {
		// Check if this is a request for chat info
		if (message.text !== undefined && tgBot.me !== undefined && message.text.toLowerCase() === `@${tgBot.me.username} chatinfo`.toLowerCase()) {
			// It is. Give it
			tgBot.sendMessage({
				chat_id: message.chat.id,
				text: "chatID: " + message.chat.id
			});
		} else {
			// Check if the message came from the correct group
			if (message.chat.id == Application.settings.telegram.chatID) {
				// Yup. Do the thing
				func(message);
			} else {
				// Tell the sender that this is a private bot
				tgBot.sendMessage({
					chat_id: message.chat.id,
					text: "This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. If you wish to use TediCross yourself, please download and create an instance. You may ask @Suppen for help"
				  })
				  .catch((err) => {
					// Hmm... Could not send the message for some reason TODO Do something about this
					console.error("Could not provide chatinfo:", err, message);
				  });
			}
		}
	}
}

/***********************
 * Export the function *
 ***********************/

module.exports = wrapFunction;
