"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");

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
 * Replies to a message with info about the chat. One of the four optional arguments must be present
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
 * Adds the bridges to the tediCross object on the context
 *
 * @param {Object} context	The context to add the property to
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addBridgesToContext(ctx, next) {
	ctx.tediCross.bridges = ctx.bridgeMap.fromTelegramChatId(ctx.tediCross.message.chat.id);
	next();
}

/**
 * Replies to the message telling the user this is a private bot
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Function} ctx.reply	The context's reply function
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function informThisIsPrivateBot(ctx, next) {
	R.ifElse(
		R.compose(
			R.isNil,
			R.path(["tediCross", "bridges"])
		),
		ctx =>
			ctx.reply(
				"This is an instance of a [TediCross](https://github.com/TediCross/TediCross) bot, "
				+ "bridging a chat in Telegram with one in Discord. "
				+ "If you wish to use TediCross yourself, please download and create an instance.",
				{
					parse_mode: "markdown"
				}
			),
		next
	)(ctx);
}

/***************
 * Export them *
 ***************/

module.exports = {
	addTediCrossObj,
	getMessageObj,
	chatinfo,
	addBridgesToContext,
	informThisIsPrivateBot
};
