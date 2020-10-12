"use strict";

/**************************
 * Import important stuff *
 **************************/

const R = require("ramda");
const middlewares = require("./middlewares");
const endwares = require("./endwares");
const { sleep } = require("../sleep");

/***********
 * Helpers *
 ***********/

/**
 * Clears old messages on a tgBot, making sure there are no updates in the queue
 *
 * @param {Telegraf} tgBot	The Telegram bot to clear messages on
 *
 * @returns {Promise}	Promise resolving to nothing when the clearing is done
 */
function clearOldMessages(tgBot, offset = -1) {
	const timeout = 0;
	const limit = 100;
	return tgBot.telegram.getUpdates(timeout, limit, offset)
		.then(R.ifElse(
			R.isEmpty,
			R.always(undefined),
			R.compose(
				newOffset => clearOldMessages(tgBot, newOffset),
				R.add(1),
				R.prop("update_id"),
				R.last
			)
		));
}

/**********************
 * The setup function *
 **********************/

/**
 * Sets up the receiving of Telegram messages, and relaying them to Discord
 *
 * @param {Logger} logger	The Logger instance to log messages to
 * @param {Telegraf} tgBot	The Telegram bot
 * @param {Discord.Client} dcBot	The Discord bot
 * @param {MessageMap} messageMap	Map between IDs of messages
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 * @param {Settings} settings	The settings to use
 */
function setup(logger, tgBot, dcBot, messageMap, bridgeMap, settings) {
	tgBot.ready = Promise.all([
		// Get info about the bot
		tgBot.telegram.getMe(),
		// Clear old messages, if wanted. XXX Sleep 1 sec if not wanted. See issue #156
		settings.telegram.skipOldMessages ? clearOldMessages(tgBot) : sleep(1000)
	])
		.then(([me]) => {
			// Log the bot's info
			logger.info(`Telegram: ${me.username} (${me.id})`);

			// Set keeping track of where the "This is an instance of TediCross..." has been sent the last minute
			const antiInfoSpamSet = new Set();

			// Add some global context
			tgBot.context.TediCross = {
				me,
				bridgeMap,
				dcBot,
				settings,
				messageMap,
				logger,
				antiInfoSpamSet
			};

			// Apply middlewares and endwares
			tgBot.use(middlewares.addTediCrossObj);
			tgBot.use(middlewares.addMessageObj);
			tgBot.use(middlewares.addMessageId);
			tgBot.command("chatinfo", endwares.chatinfo);
			tgBot.use(middlewares.addBridgesToContext);
			tgBot.use(middlewares.informThisIsPrivateBot);
			tgBot.use(middlewares.removeD2TBridges);
			tgBot.command(middlewares.removeBridgesIgnoringCommands);
			tgBot.on("new_chat_members", middlewares.removeBridgesIgnoringJoinMessages);
			tgBot.on("left_chat_member", middlewares.removeBridgesIgnoringLeaveMessages);
			tgBot.on("new_chat_members", endwares.newChatMembers);
			tgBot.on("left_chat_member", endwares.leftChatMember);
			tgBot.use(middlewares.addFromObj);
			tgBot.use(middlewares.addReplyObj);
			tgBot.use(middlewares.addForwardFrom);
			tgBot.use(middlewares.addTextObj);
			tgBot.use(middlewares.addFileObj);
			tgBot.use(middlewares.addFileLink);
			tgBot.use(middlewares.addPreparedObj);

			// Apply endwares
			tgBot.on(["edited_message", "edited_channel_post"], endwares.handleEdits);
			tgBot.use(endwares.relayMessage);
		})
		// Start getting updates
		.then(() => tgBot.startPolling());
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
