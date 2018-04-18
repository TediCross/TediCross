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
			let newOffset = offset;

			// Have all old updates been fetched?
			if (updates.length !== 0) {
				// Nope. Run it again
				const o = updates[updates.length - 1].update_id + 1;
				newOffset = clearInitialUpdates(bot, o);
			}

			// Return the new offset
			return newOffset;
		});
}

/**
 * Fetches Telegram updates
 *
 * @param {BotAPI} bot	The telegram bot to use
 * @param {Integer} offset	The update offset to use
 * @param {EventEmitter} emitter	The emitter to emit the updates from
 * @param {Boolean} debug	Whether or not to log debug messages
 */
function fetchUpdates(bot, offset, emitter, debug) {
	// Log the event if debugging is on
	if (debug) {
		Application.logger.log("Fetching Telegram updates");
	}

	// Do the fetching
	bot.getUpdates({offset, timeout: DEFAULT_TIMEOUT})
		.then((updates) => {
			offset = handleUpdates(updates, emitter) + 1;
		})
		.catch((err) => Application.logger.error("Couldn't fetch Telegram messages. Reason:", `${err.name}: ${err.message}` + debug ? err.stack : ""))
		// Do it again, no matter what happened. XXX There is currently no way to stop it
		.then(() => fetchUpdates(bot, offset, emitter, debug));
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

	// Clear old messages, if wanted
	let p = Promise.resolve();
	if (settings.telegram.skipOldMessages) {
		// Log the start of the clearing if debugging is on
		if (settings.debug) {
			Application.logger.log("Clearing old Telegram messages");
		}

		// Start clearing messages
		p = p
			.then(() => clearInitialUpdates(bot))
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
	p.then(() => fetchUpdates(bot, offset, emitter, settings.debug));

	// Return the event emitter
	return emitter;
}

/***********************
 * Export the function *
 ***********************/

module.exports = makeUpdateEmitter;
