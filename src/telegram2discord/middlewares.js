"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const Bridge = require("../bridgestuff/Bridge");
const From = require("./From");
const mime = require("mime/lite");
const handleEntities = require("./handleEntities");
const Discord = require("discord.js");
const { sleepOneMinute } = require("../sleep");
const helpers = require("./helpers");
const fetchDiscordChannel = require("../fetchDiscordChannel");

/***********
 * Helpers *
 ***********/

/**
 * Creates a text object from a Telegram message
 *
 * @param {Object} message	The message object
 *
 * @returns {Object}	The text object, or undefined if no text was found
 */
function createTextObjFromMessage(ctx, message) {
	return R.cond([
		// Text
		[
			R.has("text"),
			({ text, entities }) => ({
				raw: text,
				entities: R.defaultTo([], entities)
			})
		],
		// Animation, audio, document, photo, video or voice
		[
			R.has("caption"),
			({ caption, caption_entities }) => ({
				raw: caption,
				entities: R.defaultTo([], caption_entities)
			})
		],
		// Stickers have an emoji instead of text
		[
			R.has("sticker"),
			message => ({
				raw: R.ifElse(
					() => ctx.TediCross.settings.telegram.sendEmojiWithStickers,
					R.path(["sticker", "emoji"]),
					R.always("")
				)(message),
				entities: []
			})
		],
		// Locations must be turned into an URL
		[
			R.has("location"),
			({ location }) => ({
				raw: `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&ll=${location.latitude},${location.longitude}&z=16`,
				entities: []
			})
		],
		// Default to undefined
		[R.T, R.always({ raw: "", entities: [] })]
	])(message);
}

/**
 * Makes the reply text to show on Discord
 *
 * @param {Object} replyTo	The replyTo object from the tediCross context
 * @param {Integer} replyLength	How many characters to take from the original
 * @param {Integer} maxReplyLines	How many lines to cut the reply text after
 *
 * @returns {String}	The reply text to display
 */
const makeReplyText = (replyTo, replyLength, maxReplyLines) => {
	const countDoublePipes = R.tryCatch(str => str.match(/\|\|/g).length, R.always(0));

	// Make the reply string
	return R.compose(
		// Add ellipsis if the text was cut
		R.ifElse(R.compose(R.equals(R.length(replyTo.text.raw)), R.length), R.identity, R.concat(R.__, "…")),
		// Handle spoilers (pairs of "||" in Discord)
		R.ifElse(
			// If one of a pair of "||" has been removed
			quote =>
				R.and(
					countDoublePipes(quote, "||") % 2 === 1,
					countDoublePipes(replyTo.text.raw) % 2 === 0
				),
			// Add one to the end
			R.concat(R.__, "||"),
			// Otherwise do nothing
			R.identity
		),
		// Take only a number of lines
		R.join("\n"),
		R.slice(0, maxReplyLines),
		R.split("\n"),
		// Take only a portion of the text
		R.slice(0, replyLength)
	)(replyTo.text.raw);
};

/**
 * Makes a discord mention out of a username
 *
 * @param {String} username	The username to make the mention from
 * @param {Discord.Client} dcBot	The Discord bot to look up the user's ID with
 * @param {Bridge} bridge	The bridge to use
 *
 * @returns {String}	A Discord mention of the user
 */
async function makeDiscordMention(username, dcBot, bridge) {
	try {
		// Get the name of the Discord user this is a reply to
		const channel = await fetchDiscordChannel(dcBot, bridge);
		const dcUser = await channel.members.find(R.propEq("displayName", username));

		return R.ifElse(R.isNil, R.always(username), dcUser => `<@${dcUser.id}>`)(dcUser);
	} catch (err) {
		// Cannot make a mention. Just return the username
		return username;
	}
}

/****************************
 * The middleware functions *
 ****************************/

/**
 * Adds a `tediCross` property to the context
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addTediCrossObj(ctx, next) {
	ctx.tediCross = {};
	next();
}

/**
 * Adds a message object to the tediCross context. One of the four optional arguments must be present. Requires the tediCross context to work
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
function addMessageObj(ctx, next) {
	// Put it on the context
	ctx.tediCross.message = R.cond([
		// XXX I tried both R.has and R.hasIn as conditions. Neither worked for some reason
		[ctx => !R.isNil(ctx.update.channel_post), R.path(["update", "channel_post"])],
		[ctx => !R.isNil(ctx.update.edited_channel_post), R.path(["update", "edited_channel_post"])],
		[ctx => !R.isNil(ctx.update.message), R.path(["update", "message"])],
		[ctx => !R.isNil(ctx.update.edited_message), R.path(["update", "edited_message"])]
	])(ctx);

	next();
}

/**
 * Adds the message ID as a prop to the tedicross context
 *
 * @param {Object} ctx	The Telegraf context
 * @param {Object} ctx.tediCross	The Tedicross object on the context
 * @param {Object} ctx.tediCross.message	The message object being handled
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addMessageId(ctx, next) {
	ctx.tediCross.messageId = ctx.tediCross.message.message_id;

	next();
}

/**
 * Adds the bridges to the tediCross object on the context. Requires the tediCross context to work
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Object} ctx.TediCross	The global TediCross context
 * @param {Object} ctx.TediCross.bridgeMap	The bridge map of the application
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addBridgesToContext(ctx, next) {
	ctx.tediCross.bridges = ctx.TediCross.bridgeMap.fromTelegramChatId(ctx.tediCross.message.chat.id);
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
	ctx.tediCross.bridges = R.reject(R.propEq("direction", Bridge.DIRECTION_DISCORD_TO_TELEGRAM))(
		ctx.tediCross.bridges
	);

	next();
}

/**
 * Removes bridges with the `relayCommands` flag set to false from the bridge list
 *
 * @param {Object} ctx	The Telegraf context to use
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Bridge[]} ctx.tediCross.bridges	The bridges the message could use
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function removeBridgesIgnoringCommands(ctx, next) {
	ctx.tediCross.bridges = R.filter(R.path(["telegram", "relayCommands"]), ctx.tediCross.bridges);
	next();
}

/**
 * Removes bridges with `telegram.relayJoinMessages === false`
 *
 * @param {Object} ctx	The Telegraf context to use
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Bridge[]} ctx.tediCross.bridges	The bridges the message could use
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function removeBridgesIgnoringJoinMessages(ctx, next) {
	ctx.tediCross.bridges = R.filter(R.path(["telegram", "relayJoinMessages"]), ctx.tediCross.bridges);
	next();
}

/**
 * Removes bridges with `telegram.relayLeaveMessages === false`
 *
 * @param {Object} ctx	The Telegraf context to use
 * @param {Object} ctx.tediCross	The TediCross object on the context
 * @param {Bridge[]} ctx.tediCross.bridges	The bridges the message could use
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function removeBridgesIgnoringLeaveMessages(ctx, next) {
	ctx.tediCross.bridges = R.filter(R.path(["telegram", "relayLeaveMessages"]), ctx.tediCross.bridges);
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
		R.compose(R.isEmpty, R.path(["tediCross", "bridges"])),
		// Inform the user, if enough time has passed since last time
		R.when(
			// When there is no timer for the chat in the anti spam map
			ctx => R.not(ctx.TediCross.antiInfoSpamSet.has(ctx.tediCross.message.chat.id)),
			// Inform the chat this is an instance of TediCross
			ctx => {
				// Update the anti spam set
				ctx.TediCross.antiInfoSpamSet.add(ctx.tediCross.message.chat.id);

				// Send the reply
				ctx.reply(
					"This is an instance of a [TediCross](https://github.com/TediCross/TediCross) bot, " +
						"bridging a chat in Telegram with one in Discord. " +
						"If you wish to use TediCross yourself, please download and create an instance.",
					{
						parse_mode: "markdown"
					}
				).then(msg =>
					// Delete it again after a while
					sleepOneMinute()
						.then(() => helpers.deleteMessage(ctx, msg))
						.catch(helpers.ignoreAlreadyDeletedError)
						// Remove it from the anti spam set again
						.then(() => ctx.TediCross.antiInfoSpamSet.delete(ctx.message.chat.id))
				);
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
 * @param {Function} next	Function to pass control to next middleware
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
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addReplyObj(ctx, next) {
	const repliedToMessage = ctx.tediCross.message.reply_to_message;

	if (!R.isNil(repliedToMessage)) {
		// This is a reply
		const isReplyToTediCross =
			!R.isNil(repliedToMessage.from) && R.equals(repliedToMessage.from.id, ctx.TediCross.me.id);
		ctx.tediCross.replyTo = {
			isReplyToTediCross,
			message: repliedToMessage,
			originalFrom: From.createFromObjFromMessage(repliedToMessage),
			text: createTextObjFromMessage(ctx, repliedToMessage)
		};

		// Handle replies to TediCross
		if (isReplyToTediCross) {
			// Get the username of the Discord user who sent this and remove it from the text
			const split = R.split("\n", ctx.tediCross.replyTo.text.raw);
			ctx.tediCross.replyTo.dcUsername = R.head(split);
			ctx.tediCross.replyTo.text.raw = R.join("\n", R.tail(split));

			// Cut off the first entity (the bold text on the username) and reduce the offset of the rest by the length of the username and the newline
			ctx.tediCross.replyTo.text.entities = R.compose(
				R.map(entity =>
					R.mergeRight(entity, {
						offset: entity.offset - ctx.tediCross.replyTo.dcUsername.length - 1
					})
				),
				R.tail
			)(ctx.tediCross.replyTo.text.entities);
		}

		// Turn the original text into "<no text>" if there is no text
		if (R.isEmpty(ctx.tediCross.replyTo.text.raw)) {
			ctx.tediCross.replyTo.text.raw = "<no text>";
		}
	}

	next();
}

/**
 * Adds a `forward` object to the tediCross context, if the message is a forward
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to create the `forward` object from
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addForwardFrom(ctx, next) {
	const msg = ctx.tediCross.message;

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
 * Adds a text object to the tediCross property on the context, if there is text in the message
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to get the text data from
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {undefined}
 */
function addTextObj(ctx, next) {
	const text = createTextObjFromMessage(ctx, ctx.tediCross.message);

	if (!R.isNil(text)) {
		ctx.tediCross.text = text;
	}

	next();
}

/**
 * Adds a file object to the tediCross property on the context
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Object} ctx.tediCross.message	The message object to get the file data from
 * @param {Function} next	Function to pass control to next middleware
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
			id: message.audio.file_id,
			name: message.audio.title + "." + mime.getExtension(message.audio.mime_type)
		};
	} else if (!R.isNil(message.document)) {
		// Generic file
		ctx.tediCross.file = {
			type: "document",
			id: message.document.file_id,
			name: message.document.file_name
		};
	} else if (!R.isNil(message.photo)) {
		// Photo. It has an array of photos of different sizes. Use the last and biggest
		const photo = R.last(message.photo);
		ctx.tediCross.file = {
			type: "photo",
			id: photo.file_id,
			name: "photo.jpg" // Telegram will convert it to a jpg no matter which format is orignally sent
		};
	} else if (!R.isNil(message.sticker)) {
		// Sticker
		ctx.tediCross.file = {
			type: "sticker",
			id: R.ifElse(
				R.propEq("is_animated", true),
				R.path(["thumb", "file_id"]),
				R.prop("file_id")
			)(message.sticker),
			name: "sticker.webp"
		};
	} else if (!R.isNil(message.video)) {
		// Video
		ctx.tediCross.file = {
			type: "video",
			id: message.video.file_id,
			name: "video" + "." + mime.getExtension(message.video.mime_type)
		};
	} else if (!R.isNil(message.voice)) {
		// Voice
		ctx.tediCross.file = {
			type: "voice",
			id: message.voice.file_id,
			name: "voice" + "." + mime.getExtension(message.voice.mime_type)
		};
	}

	next();
}

/**
 * Adds a file link to the file object on the tedicross context, if there is one
 *
 * @param {Object} ctx	The context to add the property to
 * @param {Object} ctx.tediCross	The tediCross on the context
 * @param {Function} next	Function to pass control to next middleware
 *
 * @returns {Promise}	Promise resolving to nothing when the operation is complete
 */
function addFileLink(ctx, next) {
	return Promise.resolve()
		.then(() => {
			// Get a stream to the file, if one was found
			if (!R.isNil(ctx.tediCross.file)) {
				return ctx.telegram.getFileLink(ctx.tediCross.file.id).then(fileLink => {
					ctx.tediCross.file.link = fileLink.href;
				});
			}
		})
		.then(next)
		.then(R.always(undefined))
		.catch(err => {
			if (err.response && err.response.description === "Bad Request: file is too big") {
				ctx.reply("<i>File is too big for TediCross to handle</i>", { parse_mode: "html" });
			}
		});
}

async function addPreparedObj(ctx, next) {
	// Shorthand for the tediCross context
	const tc = ctx.tediCross;

	ctx.tediCross.prepared = await Promise.all(
		R.map(async bridge => {
			// Get the name of the sender of this message
			const senderName = From.makeDisplayName(
				ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername,
				tc.from
			);

			// Make the header
			// WARNING! Butt-ugly code! If you see a nice way to clean this up, please do it
			const header = await (async () => {
				// Get the name of the original sender, if this is a forward
				const originalSender = R.isNil(tc.forwardFrom)
					? null
					: From.makeDisplayName(
							ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername,
							tc.forwardFrom
					  );
				// Get the name of the replied-to user, if this is a reply
				const repliedToName = R.isNil(tc.replyTo)
					? null
					: await R.ifElse(
							R.prop("isReplyToTediCross"),
							R.compose(
								username =>
									makeDiscordMention(
										username,
										ctx.TediCross.dcBot,
										bridge
									),
								R.prop("dcUsername")
							),
							R.compose(
								R.partial(From.makeDisplayName, [
									ctx.TediCross.settings.telegram
										.useFirstNameInsteadOfUsername
								]),
								R.prop("originalFrom")
							)
					  )(tc.replyTo);
				// Build the header
				let header = "";
				if (bridge.telegram.sendUsernames) {
					if (!R.isNil(tc.forwardFrom)) {
						// Forward
						header = `**${originalSender}** (forwarded by **${senderName}**)`;
					} else if (!R.isNil(tc.replyTo)) {
						// Reply
						header = `**${senderName}** (in reply to **${repliedToName}**)`;
					} else {
						// Ordinary message
						header = `**${senderName}**`;
					}
				} else {
					if (!R.isNil(tc.forwardFrom)) {
						// Forward
						header = `(forward from **${originalSender}**)`;
					} else if (!R.isNil(tc.replyTo)) {
						// Reply
						header = `(in reply to **${repliedToName}**)`;
					} else {
						// Ordinary message
						header = "";
					}
				}

				return header;
			})();

			// Handle blockquote replies
			const replyQuote = R.ifElse(
				tc => !R.isNil(tc.replyTo),
				R.compose(R.replace(/^/gm, "> "), tc =>
					makeReplyText(
						tc.replyTo,
						ctx.TediCross.settings.discord.replyLength,
						ctx.TediCross.settings.discord.maxReplyLines
					)
				),
				R.always(undefined)
			)(tc);

			// Handle file
			const file = R.ifElse(
				R.compose(R.isNil, R.prop("file")),
				R.always(undefined),
				tc => new Discord.MessageAttachment(tc.file.link, tc.file.name)
			)(tc);

			// Make the text to send
			const text = await (async () => {
				let text = await handleEntities(
					tc.text.raw,
					tc.text.entities,
					ctx.TediCross.dcBot,
					bridge
				);

				if (!R.isNil(replyQuote)) {
					text = replyQuote + "\n" + text;
				}

				return text;
			})();

			return {
				bridge,
				header,
				senderName,
				file,
				text
			};
		})(tc.bridges)
	);

	next();
}

/***************
 * Export them *
 ***************/

module.exports = {
	addTediCrossObj,
	addMessageObj,
	addMessageId,
	addBridgesToContext,
	removeD2TBridges,
	removeBridgesIgnoringCommands,
	removeBridgesIgnoringJoinMessages,
	removeBridgesIgnoringLeaveMessages,
	informThisIsPrivateBot,
	addFromObj,
	addReplyObj,
	addForwardFrom,
	addTextObj,
	addFileObj,
	addFileLink,
	addPreparedObj
};
