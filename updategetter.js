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

					// This is a new message
					emitter.emit("message", update.message);

					// Is it a text message?
					if (update.message.text !== undefined) {
						emitter.emit("text", update.message);
					}
				}

				// Get more updates!
				process.nextTick(fetchUpdates);
			});
		  })
		  .catch(err => console.error(`${err.name}: ${err.message}`));
	}

	// Start the fetching
	fetchUpdates();

	// Mix the emitter into the bot
	for (let k in emitter) {
		bot[k] = typeof emitter[k] === "function" ? emitter[k].bind(emitter) : emitter[k];
	}

}

/***********************
 * Export the function *
 ***********************/

module.exports = updateGetter;

