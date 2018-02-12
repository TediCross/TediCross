"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const moment = require("moment");
const { EventEmitter } = require("events");
const { handleUpdates } = require("./handleUpdates");

const DEFAULT_TIMEOUT = moment.duration(1, "minute").asSeconds();

/*****************************
 * The UpdateGetter function *
 *****************************/

/**
 * Runs getUpdates until there are no more updates to get. This is meant to run
 * at the startup of the bot to remove initial cached messages if the bot has
 * been down for a while. Returns a promise that resolves to the offset of the
 * latest cleared message.
 *
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 * @param {Integer} offset	Initial offset. Same applies to this as timeout
 *
 * @returns {Promise<Integer>}	A promise which resolves to the offset to use to get new messages
 *
 * @private
 */
function clearInitialUpdates(bot, offset = 0) {
	// Get updates for the bot
	return bot.getUpdates({offset, timeout: 0})
	  .then((updates) => {
		// Have all old updates been fetched?
		if (updates.length === 0) {
			// Yup. This is the correct offset
			return offset;
		} else {
			// Nope. Run it again
			const newOffset = updates[updates.length - 1].update_id + 1;
			return clearInitialUpdates(bot, newOffset);
		}
	  });
}

/**
 * Creates an event emitter emitting update events for a Telegram bot
 *
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 * @param {Settings} settings	The settings to use
 *
 * @returns {EventEmitter}	The event emitter
 */
function makeUpdateEmitter(bot, settings) {
	// Create an event emitter
	const emitter = new EventEmitter();

	// Offset for which updates to fetch
	let offset = 0;

	// Function to fetch updates
	function fetchUpdates() {
		// Log the event if debugging is on
		if (settings.debug) {
			Application.logger.log("Fetching Telegram updates");
		}

		// Do the fetching
		bot.getUpdates({offset, timeout: DEFAULT_TIMEOUT})
		  .then((updates) => {
			offset = handleUpdates(updates, emitter) + 1;
		  })
		  .catch((err) => Application.logger.error("Couldn't fetch Telegram messages. Reason:", `${err.name}: ${err.message}` + settings.debug ? err.stack : ''))
		  .then(fetchUpdates);	// Get more updates regardless of what happens
	}

	// Clear old messages, if wanted
	let p = Promise.resolve();
	if (settings.telegram.skipOldMessages) {
		// Log the start of the clearing if debugging is on
		if (settings.debug) {
			Application.logger.log("Clearing old Telegram messages");
		}

		// Start clearing messages
		p = clearInitialUpdates(bot)
		  .then((newOffset) => {
			// Set the correct offset
			offset = newOffset;

			// Log that the clearing has ended if debugging is on
			if (settings.debug) {
				Application.logger.log("Old Telegram messages cleared");
			}
		  });
	}

	// Start the fetching
	p.then(fetchUpdates);

	// Return the event emitter
	return emitter;
}

/***********************
 * Export the function *
 ***********************/

module.exports = makeUpdateEmitter;
