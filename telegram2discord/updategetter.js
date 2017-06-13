"use strict";

/**************************
 * Import important stuff *
 **************************/

const EventEmitter = require("events").EventEmitter;

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
 * @param {Integer} [timeout]	Timeout for longpolling. Don't touch if you don't have a reason to
 * @param {Integer} offset	Initial offset. Same applies to this as timeout
 */
function clearInitialUpdates(bot, settings, timeout = 0, offset = 0) {
	// Get updates, then run clearInitialUpdates recursively with the new
	// offset until there are no more updates to get, then return the offset.
	return bot.getUpdates({ timeout, offset })
		.then(updates => ((settings.debug && console.log('[telegram/updategetter] clearing...')), updates))
		.then(updates => updates.length === 0
			? offset
			: clearInitialUpdates(
				bot,
				settings,
				timeout,
				updates[updates.length - 1].update_id + 1));
}

/**
 * Adds a longpolling update getter to a Telegram bot and mixes an event emitter into the bot
 *
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 * @param {Integer} [timeout]	Timeout for longpolling. Don't touch if you don't have a reason to
 */
function updateGetter(bot, settings, timeout = 60) {
	// Create an event emitter
	const emitter = new EventEmitter();

	// Offset for which updates to fetch
	let offset = 0;

	// Function to fetch updates
	function fetchUpdates() {
		settings.debug && console.log('[telegram/updategetter] fetching updates...');
		// Do the fetching
		bot.getUpdates({timeout, offset})
		  .then(updates => {

			// Iterate over the updates
			updates.forEach(update => {

				// Update the offset
				offset = update.update_id + 1;

				// Emit the update
				emitter.emit("update", update);

				// Check what type of update this is
				if (update.message !== undefined) {
					// Extract the message
					let message = update.message;

					// This is a new message
					emitter.emit("message", message);

					// Determine type
					if (update.message.text !== undefined) {
						emitter.emit("text", message);
					} else if (message.photo !== undefined) {
						emitter.emit("photo", message);
					} else if (message.document !== undefined) {
						emitter.emit("document", message);
					} else if (message.audio !== undefined) {
						emitter.emit("audio", message);
					} else if (message.video !== undefined) {
						emitter.emit("video", message);
					} else if (message.sticker !== undefined) {
						emitter.emit("sticker", message);
					}
				}
			});
		  })
		  .catch(err => console.error("Couldn't fetch Telegram messages. Reason:", `${err.name}: ${err.message}` + settings.debug ? err.stack : ''))
		  .then(fetchUpdates);	// Get more updates regardless of what happens
	}

	// Mix the emitter into the bot
	for (let k in emitter) {
		bot[k] = emitter[k] instanceof Function ? emitter[k].bind(emitter) : emitter[k];
	}

	// Start the fetching
	if (settings.telegram.skipOldMessages) {
		settings.debug && console.log('[telegram/updategetter] clearing old messages...');
		return clearInitialUpdates(bot, settings).then(newOffset => {
			offset = newOffset;
			settings.debug && console.log('[telegram/updategetter] initial offset: ' + offset);
			return fetchUpdates();
		})
	} else {
		fetchUpdates();
		return Promise.resolve();
	}
}

/***********************
 * Export the function *
 ***********************/

module.exports = updateGetter;

