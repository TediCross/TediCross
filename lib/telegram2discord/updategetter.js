"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const { EventEmitter } = require("events");
const { handleUpdates } = require("./handleUpdates");

const DEFAULT_TIMEOUT = 60;	// seconds

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
 * Adds a longpolling update getter to a Telegram bot and mixes an event emitter into the bot
 *
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 */
function updateGetter(bot) {
	// Create an event emitter
	const emitter = new EventEmitter();

	// Offset for which updates to fetch
	let offset = 0;

	// Function to fetch updates
	function fetchUpdates() {
		// Log the event if debugging is on
		if (Application.settings.debug) {
			Application.logger.log("Fetching Telegram updates");
		}

		// Do the fetching
		bot.getUpdates({offset, timeout: DEFAULT_TIMEOUT})
		  .then((updates) => {
			offset = handleUpdates(updates, emitter) + 1;
		  })
		  .catch((err) => Application.logger.error("Couldn't fetch Telegram messages. Reason:", `${err.name}: ${err.message}` + Application.settings.debug ? err.stack : ''))
		  .then(fetchUpdates);	// Get more updates regardless of what happens
	}

	// Mix the emitter into the bot
	for (const k in emitter) {
		bot[k] = emitter[k] instanceof Function ? emitter[k].bind(emitter) : emitter[k];
	}

	// Start the fetching
	let p = Promise.resolve();
	if (Application.settings.telegram.skipOldMessages) {
		// Log the start of the clearing if debugging is on
		if (Application.settings.debug) {
			Application.logger.log("Clearing old Telegram messages");
		}

		// Start clearing messages
		p = clearInitialUpdates(bot)
		  .then((newOffset) => {
			// Set the correct offset
			offset = newOffset;

			// Log that the clearing has ended if debugging is on
			if (Application.settings.debug) {
				Application.logger.log("Old Telegram messages cleared");
			}
		  });
	}
	p.then(fetchUpdates);
}

/***********************
 * Export the function *
 ***********************/

module.exports = updateGetter;
