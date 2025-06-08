import R from "ramda";
import middlewares from "./middlewares";
import { sleep } from "../sleep";
import { Telegraf } from "telegraf";
import { Logger } from "../Logger";
import { Client } from "discord.js";
import { MessageMap } from "../MessageMap";
import { BridgeMap } from "../bridgestuff/BridgeMap";
import { Settings } from "../settings/Settings";
import {
	chatinfo,
	threadinfo,
	handleEdits,
	leftChatMember,
	newChatMembers,
	relayMessage,
	TediCrossContext,
	channelChatInfo
} from "./endwares";
import { BotCommand, ChatAdministratorRights } from "telegraf/types";
import { connect } from "./commands/connect";
import { remove } from "./commands/remove";
import { processCallback } from "./commands/callbacks";

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
				R.compose<any, any>(
					newOffset => clearOldMessages(tgBot, newOffset),
					//@ts-ignore
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
	use: any | TediCrossContext;
	// eslint-disable-next-line
	on: any | ((value: string) => TediCrossContext);
	context: TediCrossContext;
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
	//@ts-ignore
	tgBot.ready = Promise.all([
		// Get info about the bot
		tgBot.telegram.getMe(),
		// Clear old messages, if wanted. XXX Sleep 1 sec if not wanted. See issue #156
		settings.telegram.skipOldMessages ? clearOldMessages(tgBot) : sleep(1000)
	])
		.then(([me]) => {
			// Log the bot's info
			logger.info(`Telegram: ${me.username} (${me.id})`);

			const myCommands: BotCommand[] = [
				{
					command: "chatinfo",
					description: "Get info about the chat"
				},
				{
					command: "threadinfo",
					description: "Get info about the thread"
				},
				{
					command: "connect",
					description: "Connect channels between Telegram and Discord"
				},
				{
					command: "remove",
					description: "Remove an existing bridge"
				}
			];

			// Set the commands for all scopes: default, groups, and channels
			Promise.all([
				// Default scope (private chats)
				tgBot.telegram.setMyCommands(myCommands, { scope: { type: "default" } }),
				// Group chats
				tgBot.telegram.setMyCommands(myCommands, { scope: { type: "all_group_chats" } }),
				// Channel chats
				tgBot.telegram.setMyCommands(myCommands, { scope: { type: "all_chat_administrators" } })
			]).then(() => {
				// wait 5 seconds to make sure the commands are set
				setTimeout(() => {
					tgBot.telegram.getMyCommands().then((commands: BotCommand[]) => {
						logger.info("Telegram commands:", commands);
						if (commands.length < 4) {
							throw new Error("Telegram: Expected 4 commands, got " + commands.length);
						}
					});
				}, 5000);
			});

			const defaultPermissions: ChatAdministratorRights = {
				can_manage_chat: true,
				can_delete_messages: true,
				can_change_info: true,
				can_invite_users: true,
				can_post_messages: true,
				can_edit_messages: true,
				can_pin_messages: true,
				can_manage_topics: true,
				is_anonymous: false,
				can_manage_video_chats: false,
				can_restrict_members: false,
				can_promote_members: false
			};

			// Set default admin permissions for groups and super groups
			tgBot.telegram.setMyDefaultAdministratorRights({
				rights: defaultPermissions,
				forChannels: false
			});

			// Set default admin permissions for channel
			tgBot.telegram.setMyDefaultAdministratorRights({
				rights: defaultPermissions,
				forChannels: true
			});

			// Set keeping track of where the "This is an instance of TediCross..." has been sent the last minute
			const antiInfoSpamSet = new Set();

			const groupIdMap: Map<string, TediCrossContext[]> = new Map();

			// Add some global context
			tgBot.context.TediCross = {
				me,
				bridgeMap,
				dcBot,
				settings,
				messageMap,
				logger,
				antiInfoSpamSet,
				groupIdMap
			};

			const skipCallbackQueries = (middlewareFn: any) => {
				return (ctx: any, next: () => void) => {
					// Skip for callback queries
					if (ctx.callbackQuery) {
						next();
						return;
					}

					// Skip if no message
					// if (!ctx.tediCross || !ctx.tediCross.message) {
					// 	next();
					// 	return;
					// }

					// Process the middleware function
					return middlewareFn(ctx, next);
				};
			};

			// Apply middlewares and endwares
			tgBot.command("chatinfo", chatinfo);
			tgBot.command("threadinfo", threadinfo);
			tgBot.command("connect", connect as any);
			tgBot.command("remove", remove as any);
			tgBot.use(channelChatInfo as any);
			tgBot.use(middlewares.addTediCrossObj);
			tgBot.use(middlewares.addMessageObj);
			tgBot.use(skipCallbackQueries(middlewares.addMessageId));
			tgBot.use(skipCallbackQueries(middlewares.addBridgesToContext));
			tgBot.use(skipCallbackQueries(middlewares.informThisIsPrivateBot));
			tgBot.use(skipCallbackQueries(middlewares.removeD2TBridges));

			//@ts-ignore telegram expacts a second parameter
			//tgBot.command(middlewares.removeBridgesIgnoringCommands);
			tgBot.on("new_chat_members", middlewares.removeBridgesIgnoringJoinMessages);
			tgBot.on("left_chat_member", middlewares.removeBridgesIgnoringLeaveMessages);
			tgBot.on("new_chat_members", newChatMembers);
			tgBot.on("left_chat_member", leftChatMember);
			tgBot.use(skipCallbackQueries(middlewares.addFromObj));
			tgBot.use(skipCallbackQueries(middlewares.addReplyObj));
			tgBot.use(skipCallbackQueries(middlewares.addForwardFrom));
			tgBot.use(skipCallbackQueries(middlewares.addTextObj));
			tgBot.use(skipCallbackQueries(middlewares.addFileObj));
			tgBot.use(skipCallbackQueries(middlewares.addFileLink));
			tgBot.use(skipCallbackQueries(middlewares.addPreparedObj));

			// Add callback query handler for connect and remove commands
			tgBot.on("callback_query", async (ctx: any) => {
				try {
					await processCallback(ctx);
				} catch (error: any) {
					logger.error(`Error in callback query handler: ${error.message}`);
					logger.error(error.stack);
					try {
						await ctx.answerCbQuery("An error occurred");
					} catch (err) {
						// Ignore error answering callback query
					}
				}
			});

			// Apply endwares
			tgBot.on(["edited_message", "edited_channel_post"], handleEdits);
			tgBot.use(relayMessage as any);

			// Don't crash on errors
			tgBot.catch((err: any) => {
				// The docs says timeout errors should always be rethrown
				// @ts-ignore TODO: Telefraf does not exprt the TimoutError, alternative implementation needed

				// Log other errors, but don't do anything with them
				logger.error(err);
			});
		})
		// Start getting updates
		//@ts-ignore TODO: startPooling is a private method. Maybe use .launch() instead
		.then(() => tgBot.startPolling());
}
