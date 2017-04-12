"use strict";

/**************************
 * Import important stuff *
 **************************/

const EventEmitter = require("events").EventEmitter;

/*****************************
 * The UpdateGetter function *
 *****************************/

/**
 * Adds a longpolling update getter to a Telegram bot and mixes an event emitter into the bot
 *
 * @param {teleapiwrapper.BotAPI} bot	The bot to get updates for
 * @param {Integer} [timeout]	Timeout for longpolling. Don't touch if you don't have a reason to
 */
function updateGetter(bot, timeout = 60) {
	// Create an event emitter
	const emitter = new EventEmitter();

	// Offset for which updates to fetch
	let offset = 0;

	// Function to fetch updates
	function fetchUpdates() {
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
					if (update.message.text !== undefined) {	// Text message
						emitter.emit("text", message);
					} else if (message.photo) {
						emitter.emit("photo", message);	// Photo
					} else if (message.document) {
						emitter.emit("document", message);	// Document
					} else if (message.audio) {
						emitter.emit("audio", message);	// Audio
					} else if (message.video) {
						emitter.emit("video", message);
					}
				}
			});
		  })
		  .catch(err => console.error(`${err.name}: ${err.message}`))
		  .then(() => process.nextTick(fetchUpdates));	// Get more updates regardless of what happens
	}

	// Start the fetching
	fetchUpdates();

	// Mix the emitter into the bot
	for (let k in emitter) {
		bot[k] = emitter[k] instanceof Function ? emitter[k].bind(emitter) : emitter[k];
	}
}

/***********************
 * Export the function *
 ***********************/

module.exports = updateGetter;

