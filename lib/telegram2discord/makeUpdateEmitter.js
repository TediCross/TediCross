"use strict";

/**************************
 * Import important stuff *
 **************************/

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
 * been down for a while
 *
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 *
 * @returns {Promise}	A promise which resolves when all updates have been cleared
 *
 * @private
 */
async function clearInitialUpdates(bot) {
	// Get updates for the bot. -1 means only the latest update will be fetched
	const updates = await bot.getUpdates({offset: -1, timeout: 0});

	// If an update was fetched, confirm it by sending a new request with its ID +1
	if (updates.length > 0) {
		const offset = updates[updates.length-1].update_id + 1;
		await bot.getUpdates({offset, timeout: 0});
	}

	// All updates are now cleared
}

/**
 * Fetches Telegram updates
 *
 * @param {Logger} logger	The Logger instance to log messages to
 * @param {BotAPI} bot	The telegram bot to use
 * @param {Integer} offset	The update offset to use
 * @param {EventEmitter} emitter	The emitter to emit the updates from
 *
 * @private
 */
async function fetchUpdates(logger, bot, offset, emitter) {
	// Log the event if debugging is on
	logger.debug("Fetching Telegram updates");

	try {
		// Do the fetching
		const updates = await bot.getUpdates({offset, timeout: DEFAULT_TIMEOUT});
		offset = handleUpdates(updates, emitter) + 1;
	} catch (err) {
		logger.error("Couldn't fetch Telegram messages. Reason:", `${err.name}: ${err.message}`);
		logger.debug(err.stack);
	} finally {
		// Do it again, no matter what happened. XXX There is currently no way to stop it
		fetchUpdates(logger, bot, offset, emitter);
	}
}

/**
 * Creates an event emitter emitting update events for a Telegram bot
 *
 * @param {Logger} logger	The Logger instance to log messages to
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 * @param {Settings} settings	The settings to use
 *
 * @returns {EventEmitter}	The event emitter
 */
function makeUpdateEmitter(logger, bot, settings) {
	// Create an event emitter
	const emitter = new EventEmitter();

	// Clear old messages, if wanted
	let p = Promise.resolve();
	if (settings.telegram.skipOldMessages) {
		// Log the start of the clearing if debugging is on
		logger.debug("Clearing old Telegram messages");

		// Start clearing messages
		p = clearInitialUpdates(bot)
			.then(() => {
				// Log that the clearing has ended if debugging is on
				logger.debug("Old Telegram messages cleared");
			});
	}

	// Start the fetching
	p.then(() => fetchUpdates(logger, bot, 0, emitter));

	// Return the event emitter
	return emitter;
}

/***********************
 * Export the function *
 ***********************/

module.exports = makeUpdateEmitter;
