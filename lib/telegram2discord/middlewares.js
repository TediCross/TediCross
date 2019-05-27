"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const Bridge = require("../bridgestuff/Bridge");
const From = require("./From");
const mime = require("mime/lite");
const request = require("request");

/****************************
 * The middleware functions *
 ****************************/

/**
 * Adds a `tediCross` property to the context
 *
 * @param {Object} context	The context to add the property to
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addTediCrossObj(ctx, next) {
	ctx.tediCross = {};
	next();
}

/**
 * Replies to a message with info about the chat. One of the four optional arguments must be present. Requires the tediCross context to work
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Object} [ctx.channelPost]
 * @param {Object} [ctx.editedChannelPost]
 * @param {Object} [ctx.message]
 * @param {Object} [ctx.editedChannelPost]
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function getMessageObj(ctx, next) {
	// Get the proper message object
	const message = R.cond([
		// XXX I tried both R.has and R.hasIn as conditions. Neither worked for some reason
		[ctx => !R.isNil(ctx.channelPost), R.prop("channelPost")],
		[ctx => !R.isNil(ctx.editedChannelPost), R.prop("editedChannelPost")],
		[ctx => !R.isNil(ctx.message), R.prop("message")],
		[ctx => !R.isNil(ctx.editedMessage), R.prop("editedMessage")]
	])(ctx);

	// Put it on the context
	ctx.tediCross.message = message;

	next();
}

/**
 * Replies to a message with info about the chat
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Object} ctx.tediCross.message	The message to reply to
 * @param {Object} ctx.tediCross.message.chat	The object of the chat the message is from
 * @param {Integer} ctx.tediCross.message.chat.id	ID of the chat the message is from
 *
 * @returns {undefined}
 */
function chatinfo(ctx) {
	ctx.reply(`chatID: ${ctx.tediCross.message.chat.id}`);
}

/**
 * Adds the bridges to the tediCross object on the context. Requires the tediCross context to work
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addBridgesToContext(ctx, next) {
	ctx.tediCross.bridges = ctx.bridgeMap.fromTelegramChatId(ctx.tediCross.message.chat.id);
	next();
}

/**
 * Removes d2t bridges from the bridge list
 *
 * @param {Object} ctx	The Telegraf context to use
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Bridge[]} ctx.tediCross.bridges	The bridges the message could use
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function removeD2TBridges(ctx, next) {
	ctx.tediCross.bridges = ctx.tediCross.bridges.filter(R.compose(
		R.not,
		R.equals(Bridge.DIRECTION_DISCORD_TO_TELEGRAM),
		R.prop("direction")
	));

	next();
}

/**
 * Removes bridges with the `ignoreCommand` flag from the bridge list
 *
 * @param {Object} ctx	The Telegraf context to use
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Bridge[]} ctx.tediCross.bridges	The bridges the message could use
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function removeBridgesIgnoringCommands(ctx, next) {
	ctx.tediCross.bridges = ctx.tediCross.bridges.filter(R.path(["telegram", "ignoreCommands"]));
	next();
}

/**
 * Replies to the message telling the user this is a private bot if there are no bridges on the tediCross context
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Function} ctx.reply	The context's reply function
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function informThisIsPrivateBot(ctx, next) {
	R.ifElse(
		// If there are no bridges
		R.compose(
			R.isEmpty,
			R.path(["tediCross", "bridges"])
		),
		// Inform the user
		ctx =>
			ctx.reply(
				"This is an instance of a [TediCross](https://github.com/TediCross/TediCross) bot, "
				+ "bridging a chat in Telegram with one in Discord. "
				+ "If you wish to use TediCross yourself, please download and create an instance.",
				{
					parse_mode: "markdown"
				}
			),
		// Otherwise go to next middleware
		next
	)(ctx);
}

/**
 * Adds a `from` object to the tediCross context
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to create the `from` object from
 *
 * @returns {undefined}
 */
function addFromObj(ctx, next) {
	ctx.tediCross.from = From.createFromObjFromMessage(ctx.tediCross.message);
	next();
}

/**
 * Adds a `reply` object to the tediCross context, if the message is a reply
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to create the `reply` object from
 *
 * @returns {undefined}
 */
function addReplyObj(ctx, next) {
	const repliedToMessage = ctx.tediCross.message.reply_to_message;

	if (!R.isNil(repliedToMessage)) {
		// This is a reply
		ctx.tediCross.replyTo = {
			message: repliedToMessage,
			originalFrom: From.createFromObjFromMessage(repliedToMessage),
			isReplyToTediCross: !R.isNil(repliedToMessage.from) && repliedToMessage.from.id === ctx.self.id
		};
	}

	next();
}

/**
 * Adds a `forward` object to the tediCross context, if the message is a forward
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to create the `forward` object from
 *
 * @returns {undefined}
 */
function addForwardFrom(ctx, next) {
	const msg = ctx.message;

	if (!R.isNil(msg.forward_from) || !R.isNil(msg.forward_from_chat)) {
		ctx.tediCross.forwardFrom = R.ifElse(
			// If there is no `forward_from` prop
			R.compose(R.isNil, R.prop("forward_from")),
			// Then this is a forward from a chat (channel)
			R.compose(From.createFromObjFromChat, R.prop("forward_from_chat")),
			// Else it is from a user
			R.compose(From.createFromObjFromUser, R.prop("forward_from"))
		)(msg);
	}

	next();
}

/**
 * Adds a text object to the tediCross property on the context
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to get the text data from
 *
 * @returns {undefined}
 */
function addTextObj(ctx, next) {
	if (!R.isNil(ctx.tediCross.message.text)) {
		// Text
		ctx.tediCross.text = {
			raw: ctx.tediCross.message.text,
			entities: R.defaultTo([], ctx.tediCross.message.entities)
		};
	} else if (!R.isNil(ctx.tediCross.message.caption)) {
		// Animation, audio, document, photo, video or voice,
		ctx.tediCross.text = {
			raw: ctx.tediCross.message.caption,
			entities: R.defaultTo([], ctx.tediCross.message.caption_entities)
		};
	} else if (!R.isNil(ctx.tediCross.sticker)) {
		// Stickers have an emoji instead of text
		ctx.tediCross.text = {
			raw: ctx.tediCross.sticker.emoji,
			entities: []
		};
	}

	next();
}

/**
 * Adds a file object to the tediCross property on the context
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to get the file data from
 *
 * @returns {undefined}
 */
function addFileObj(ctx, next) {
	const message = ctx.tediCross.message;

	// Figure out if a file is present
	if (!R.isNil(message.audio)) {
		// Audio
		ctx.tediCross.file = {
			type: "audio",
			fileId: message.audio.file_id,
			fileName: message.audio.title + "." + mime.getExtension(message.audio.mime_type)
		};
	} else if (!R.isNil(message.document)) {
		// Generic file
		ctx.tediCross.file = {
			type: "document",
			fileId: message.document.file_id,
			fileName: message.document.file_name
		};
	} else if (!R.isNil(message.photo)) {
		// Photo. It has an array of photos of different sizes. Use the first and biggest
		const photo = R.head(message.photo);
		ctx.tediCross.file = {
			type: "photo",
			fileId: photo.file_id,
			fileName: "photo.jpg" // Telegram will convert it to a jpg no matter which format is orignally sent
		};
	} else if (!R.isNil(message.sticker)) {
		// Sticker
		ctx.tediCross.file = {
			type: "sticker",
			fileId: message.sticker.file_id,
			fileName: "sticker.webp"
		};
	} else if (!R.isNil(message.video)) {
		// Video
		ctx.tediCross.file = {
			type: "video",
			fileId: message.video.file_id,
			fileName: "video" + "." + mime.getExtension(message.video.mime_type),
		};
	} else if (!R.isNil(message.voice)) {
		// Voice
		ctx.tediCross.file = {
			type: "voice",
			fileId: message.voice.file_id,
			fileName: "voice" + "." + mime.getExtension(message.voice.mime_type),
		};
	}

	Promise.resolve()
		.then(() => {
			// Get a stream to the file, if one was found
			if (!R.isNil(ctx.tediCross.file)) {
				return ctx.telegram.getFileLink(ctx.tediCross.file.fileId)
					.then(fileLink => {
						ctx.tediCross.file.stream = request(fileLink);
					});
			}
		})
		.then(next);
}

/***************
 * Export them *
 ***************/

module.exports = {
	addTediCrossObj,
	getMessageObj,
	chatinfo,
	addBridgesToContext,
	removeD2TBridges,
	removeBridgesIgnoringCommands,
	informThisIsPrivateBot,
	addFromObj,
	addReplyObj,
	addForwardFrom,
	addTextObj,
	addFileObj
};
