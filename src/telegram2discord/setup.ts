import R from "ramda";
import middlewares from "./middlewares";
import { sleep } from "../sleep";
import { Context, Middleware, Telegraf } from "telegraf";
import { Logger } from "../Logger";
import { Client } from "discord.js";
import { MessageMap } from "../MessageMap";
import { BridgeMap } from "../bridgestuff/BridgeMap";
import { Settings } from "../settings/Settings";
import { chatinfo, handleEdits, leftChatMember, newChatMembers, relayMessage, TediCrossContext } from "./endwares";
import { TimeoutError } from "p-timeout";
import { Update } from "telegraf/typings/core/types/typegram";
import * as tt from "telegraf/typings/telegram-types";
import { NarrowedContext, NonemptyReadonlyArray } from "telegraf/typings/composer";

type MaybeArray<T> = T | T[];
type MatchedContext<C extends Context, T extends tt.UpdateType | tt.MessageSubType> = NarrowedContext<
	C,
	tt.MountMap[T]
>;

/***********
 * Helpers *
 ***********/

/**
 * Clears old messages on a tgBot, making sure there are no updates in the queue
 *
 * @param tgBot	The Telegram bot to clear messages on
 *
 * @returns Promise resolving to nothing when the clearing is done
 */
function clearOldMessages(tgBot: Telegraf, offset = -1): Promise<void> {
	const timeout = 0;
	const limit = 100;
	return tgBot.telegram
		.getUpdates(timeout, limit, offset, [])
		.then(
			R.ifElse(
				R.isEmpty,
				R.always(undefined),
				R.compose<Update[][], Update, number, number, void>(
					newOffset => clearOldMessages(tgBot, newOffset),
					R.add(1),
					R.prop("update_id"),
					R.last
				)
			)
		)
		.then(() => undefined);
}

/**********************
 * The setup function *
 **********************/

export interface TediTelegraf extends Telegraf {
	use(...fns: ReadonlyArray<Middleware<TediCrossContext>>): this;
	on<T extends tt.UpdateType | tt.MessageSubType>(
		updateType: MaybeArray<T>,
		...fns: NonemptyReadonlyArray<Middleware<MatchedContext<TediCrossContext, T>>>
	): this;
	context: TediCrossContext;
	ready?: Promise<void>;
}

/**
 * Sets up the receiving of Telegram messages, and relaying them to Discord
 *
 * @param logger The Logger instance to log messages to
 * @param tgBot The Telegram bot
 * @param dcBot The Discord bot
 * @param messageMap Map between IDs of messages
 * @param bridgeMap Map of the bridges to use
 * @param settings The settings to use
 */
export function setup(
	logger: Logger,
	tgBot: TediTelegraf,
	dcBot: Client,
	messageMap: MessageMap,
	bridgeMap: BridgeMap,
	settings: Settings
) {
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
			tgBot.use(chatinfo);
			tgBot.use(middlewares.addBridgesToContext);
			tgBot.use(middlewares.informThisIsPrivateBot);
			tgBot.use(middlewares.removeD2TBridges);
			//@ts-expect-error telegram expects a second parameter
			tgBot.command(middlewares.removeBridgesIgnoringCommands);
			tgBot.on("new_chat_members", middlewares.removeBridgesIgnoringJoinMessages);
			tgBot.on("left_chat_member", middlewares.removeBridgesIgnoringLeaveMessages);
			tgBot.on("new_chat_members", newChatMembers);
			tgBot.on("left_chat_member", leftChatMember);
			tgBot.use(middlewares.addFromObj);
			tgBot.use(middlewares.addReplyObj);
			tgBot.use(middlewares.addForwardFrom);
			tgBot.use(middlewares.addTextObj);
			tgBot.use(middlewares.addFileObj);
			tgBot.use(middlewares.addFileLink);
			tgBot.use(middlewares.addPreparedObj);

			// Apply endwares
			tgBot.on(["edited_message", "edited_channel_post"], handleEdits);
			tgBot.use(relayMessage as (ctx: TediCrossContext<Update>, next: () => void) => void);

			// Don't crash on errors
			tgBot.catch((err: unknown) => {
				// The docs says timeout errors should always be rethrown
				if (err instanceof TimeoutError) {
					throw err;
				}

				// Log other errors, but don't do anything with them
				console.error(err);
			});
		})
		// Start getting updates
		.then(() => tgBot.launch());
}
