"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/*****************************
 * The handleUpdate function *
 *****************************/

/**
 * Handles update objects
 *
 * @param {Update[]} updates	The updates to handle
 * @param {EventEmitter} emitter	The event emitter to use for emitting the updates
 *
 * @returns {Integer}	ID of the last processed update
 */
function handleUpdates(updates, emitter) {
	return updates.reduce((newOffset, update) => handleUpdate(update, emitter), 0);
}

/**
 * Finds out what type of update an update object is, and emits it as an event
 *
 * @param {Update} update	The update object to handle
 * @param {EventEmitter} emitter	The event emitter to use
 *
 * @returns {Integer}	ID of the update
 */
function handleUpdate(update, emitter) {
	// Check what type of update this is
	if (update.message !== undefined || update.channel_post !== undefined) {
		// Extract the message. Treat ordinary messages and channel posts the same
		const message = update.message || update.channel_post;

		// Determine type
		if (message.text !== undefined) {
			emitter.emit("text", message);
		} else if (message.photo !== undefined) {
			emitter.emit("photo", message);
		} else if (message.document !== undefined) {
			emitter.emit("document", message);
		} else if (message.voice !== undefined) {
			emitter.emit("voice", message);
		} else if (message.audio !== undefined) {
			emitter.emit("audio", message);
		} else if (message.video !== undefined) {
			emitter.emit("video", message);
		} else if (message.sticker !== undefined) {
			emitter.emit("sticker", message);
		} else if (message.new_chat_members !== undefined) {
			emitter.emit("newParticipants", message);
		} else if (message.left_chat_member !== undefined) {
			emitter.emit("participantLeft",  message);
		}
	} else if (update.edited_message !== undefined) {
		// Extract the message
		const message = update.edited_message;

		// This is an update to a message
		emitter.emit("messageEdit", message);
	}

	// Return the new offset
	return update.update_id;
}

/*************
 * Export it *
 *************/

module.exports = {
	handleUpdates,
	handleUpdate
};
