import { TediCrossContext } from "../endwares";
import { Client as DiscordClient, ChannelType, TextChannel } from "discord.js";
import { Settings } from "../../settings/Settings";
import { writeFileSync } from "fs";
import path from "path";
import jsYaml from "js-yaml";
import { registerCallbackHandler } from "./callbacks";
import { Message } from "telegraf/typings/core/types/typegram";

// Store user states (which step they're on in the connection process)
const userStates = new Map<
	number,
	{
		step: string;
		telegramChatId?: number;
		telegramChatName?: string;
		telegramThreadId?: number;
		telegramThreadName?: string;
		discordChannelId?: string;
		discordChannelName?: string;
		originalMessageId?: number;
		isThreadConnection?: boolean;
	}
>();

/**
 * Command to connect Telegram and Discord channels
 */
export async function connect(ctx: TediCrossContext) {
	if (!ctx.from) {
		await ctx.reply("Error: Could not identify user.");
		return;
	}

	const userId = ctx.from?.id;
	const logger = ctx.TediCross.logger;

	try {
		// Check if command is being used in private chat
		if (!ctx.chat) {
			await ctx.reply("Error: Could not identify chat.");
			return;
		}

		// Detect if command was invoked from a thread
		const isFromThread = !!(ctx.message as any)?.message_thread_id;
		const threadId = isFromThread ? (ctx.message as any).message_thread_id : undefined;

		logger.info(`Connect command invoked. Chat ID: ${ctx.chat.id}, Thread ID: ${threadId || 'none'}, Is from thread: ${isFromThread}`);

		// Initialize state for this user
		let userState = { 
			step: "select_telegram_channel",
			isThreadConnection: isFromThread,
			telegramThreadId: threadId
		} as {
			step: string;
			telegramChatId?: number;
			telegramChatName?: string;
			telegramThreadId?: number;
			telegramThreadName?: string;
			discordChannelId?: string;
			discordChannelName?: string;
			originalMessageId?: number;
			isThreadConnection?: boolean;
		};

		// Check if command is being used in a group/channel
		if (ctx.chat.type !== "private") {
			// Check if user is an admin in this chat
			try {
				const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
				const isAdmin = admins.some((admin: any) => admin.user.id === userId);

				if (!isAdmin) {
					await ctx.reply("You need to be an admin in this chat to connect it.");
					return;
				}

				// Get chat details
				const chat = await ctx.telegram.getChat(ctx.chat.id);
				const chatTitle = (chat.type !== 'private'
					? chat.title
					: (chat as any).username || `Chat: ${ctx.chat.id}`);

				// Determine what we're connecting
				let connectionDescription: string;
				if (isFromThread) {
					// Try to get thread info if possible
					let threadName = `Thread ${threadId}`;
					try {
						// For forum topics, we might be able to get more info
						// For now, we'll use a generic name
						threadName = `Thread ${threadId}`;
					} catch (error) {
						logger.warn(`Could not get thread name for thread ${threadId}: ${error}`);
					}
					
					userState.telegramThreadName = threadName;
					connectionDescription = `this Telegram thread (${threadName}) in chat "${chatTitle}"`;
					logger.info(`Connecting thread ${threadId} in chat ${ctx.chat.id} (${chatTitle})`);
				} else {
					connectionDescription = `this Telegram chat "${chatTitle}"`;
					logger.info(`Connecting chat ${ctx.chat.id} (${chatTitle})`);
				}

				// Use the current chat directly
				logger.info(`Using current chat for connection: ${ctx.chat.id} (${chatTitle})`);

				// Skip to Discord channel selection
				userState = {
					...userState,
					step: "select_discord_channel",
					telegramChatId: ctx.chat.id,
					telegramChatName: chatTitle
				};

				userStates.set(userId, userState);

				// Get available Discord channels and show them
				const discordChannels = await getAvailableDiscordChannels(ctx.TediCross.dcBot);

				if (discordChannels.length === 0) {
					await ctx.reply("No Discord channels found. Make sure the bot has access to channels.");
					userStates.delete(userId);
					return;
				}

				// Create inline keyboard with Discord channels
				const keyboard = discordChannels.map(channel => [
					{
						text: channel.name,
						callback_data: `dc_channel:${channel.id}`
					}
				]);

				// Store the original message for later reference
				const sentMessage = (await ctx.reply(
					`Using ${connectionDescription} for connection.\nNow select a Discord channel:`,
					{ reply_markup: { inline_keyboard: keyboard } }
				)) as Message.TextMessage;

				// Store the message ID in user state for later reference
				userState.originalMessageId = sentMessage.message_id;
				userStates.set(userId, userState);

				return;
			} catch (error) {
				logger.error(`Error checking admin status: ${error}`);
				await ctx.reply("Error checking permissions. Try again or contact the bot administrator.");
				return;
			}
		}

		// If we're in a private chat, proceed with the original flow
		// Initialize or reset user state
		userStates.set(userId, userState);

		// Get available Telegram channels where the bot is a member
		const telegramChannels = await getAvailableTelegramChannels(ctx);

		if (telegramChannels.length === 0) {
			await ctx.reply("No Telegram channels found. Please add this bot to a channel first.");
			userStates.delete(userId);
			return;
		}

		// Create inline keyboard with available Telegram channels
		const keyboard = telegramChannels.map(channel => [
			{
				text: (channel as any).title || `Chat: ${channel.id}`,
				callback_data: `tg_channel:${channel.id}`
			}
		]);

		const promptMessage = isFromThread 
			? "Select a Telegram channel to connect this thread to:" 
			: "Select a Telegram channel to connect:";

		await ctx.reply(promptMessage, { reply_markup: { inline_keyboard: keyboard } });
	} catch (err: any) {
		logger.error(`Error in connect command: ${err?.message || "Unknown error"}`);
		await ctx.reply("An error occurred while fetching channels.");
		userStates.delete(userId);
	}
}

/**
 * Get available Telegram channels where the bot is a member
 */
async function getAvailableTelegramChannels(ctx: TediCrossContext) {
	// Define proper type for channels array
	const channels: { id: number; title?: string; type?: string }[] = [];
	const userId = ctx.from?.id;
	const logger = ctx.TediCross.logger;

	if (!userId) {
		return [];
	}

	try {
		// Get all chats where the bot is a member
		// This approach gets chats from the settings
		for (const bridge of ctx.TediCross.settings.bridges) {
			try {
				const chatId = bridge.telegram.chatId;
				const chat = await ctx.telegram.getChat(chatId);

				// Check if user is an admin in this chat
				const admins = await ctx.telegram.getChatAdministrators(chatId);
				const isAdmin = admins.some((admin: any) => admin.user.id === userId);

				if (isAdmin) {
					// Only add if not already in the list
					if (!channels.some(c => c.id === chat.id)) {
						channels.push(chat);
					}
				}
			} catch (error) {
				// Skip chats where we can't get info or user is not admin
				continue;
			}
		}
	} catch (error) {
		// Return whatever we have if there are errors
	}

	return channels;
}

/**
 * Process callback queries for channel selection
 */
export async function processConnectCallback(ctx: TediCrossContext) {
	if (!ctx.callbackQuery) return;

	// Telegraf has different types of callback queries, we need to check if it's a data query
	const callbackQuery = ctx.callbackQuery as any;
	if (!callbackQuery.data) return;

	const data = callbackQuery.data as string;
	const userId = callbackQuery.from.id;
	const userState = userStates.get(userId);
	const dcBot = ctx.TediCross.dcBot;
	const logger = ctx.TediCross.logger;
	const settings = ctx.TediCross.settings;

	// Debug logging
	logger.info(`Processing callback: ${data}`);
	logger.debug(`Current user state: ${JSON.stringify(userState)}`);

	if (!userState) {
		await ctx.answerCbQuery("Session expired. Please start over with /connect");
		return;
	}

	// Track whether we're in the original chat or private message
	const isInOriginalChat = userState.telegramChatId && ctx.chat?.id !== userId;

	try {
		// Handle Telegram channel selection
		if (data.startsWith("tg_channel:")) {
			logger.info(`Processing Telegram channel selection: ${data}`);
			const telegramChatId = Number(data.split(":")[1]);

			try {
				const telegramChat = await ctx.telegram.getChat(telegramChatId);
				logger.debug(`Retrieved telegram chat: ${JSON.stringify(telegramChat)}`);

				// Update user state
				userState.telegramChatId = telegramChatId;
				userState.telegramChatName = (telegramChat as any).title || `Chat: ${telegramChatId}`;
				userState.step = "select_discord_channel";

				// Get available Discord channels
				const discordChannels = await getAvailableDiscordChannels(dcBot);
				logger.info(`Found ${discordChannels.length} Discord channels`);

				if (discordChannels.length === 0) {
					await ctx.answerCbQuery();
					await ctx
						.editMessageText("No Discord channels found. Make sure the bot has access to channels.", {
							reply_markup: { inline_keyboard: [] }
						})
						.catch(error => {
							logger.error(`Error editing message text: ${error.message}`);
						});
					userStates.delete(userId);
					return;
				}

				// Create inline keyboard with Discord channels
				const keyboard = discordChannels.map(channel => [
					{
						text: channel.name,
						callback_data: `dc_channel:${channel.id}`
					}
				]);

				// Always answer the callback query first
				await ctx.answerCbQuery();

				const connectionType = userState.isThreadConnection ? "thread" : "channel";
				const selectionMessage = userState.isThreadConnection 
					? `Selected Telegram channel: ${userState.telegramChatName} (Thread: ${userState.telegramThreadName || userState.telegramThreadId})\nNow select a Discord channel:`
					: `Selected Telegram channel: ${userState.telegramChatName}\nNow select a Discord channel:`;

				try {
					// Edit the message if we have a message to edit
					if (userState.originalMessageId) {
						await ctx.telegram.editMessageText(
							ctx.chat?.id,
							userState.originalMessageId,
							undefined,
							selectionMessage,
							{ reply_markup: { inline_keyboard: keyboard } }
						);
					} else {
						await ctx.editMessageText(
							selectionMessage,
							{ reply_markup: { inline_keyboard: keyboard } }
						);
					}
				} catch (editError: any) {
					logger.error(`Error editing message: ${editError.message}`);
					// Try sending a new message instead
					await ctx.reply(
						selectionMessage,
						{ reply_markup: { inline_keyboard: keyboard } }
					);
				}
			} catch (telegramError: any) {
				logger.error(`Error getting Telegram chat: ${telegramError.message}`);
				await ctx.answerCbQuery("Error retrieving Telegram chat information");
			}
		}
		// Handle Discord channel selection
		else if (data.startsWith("dc_channel:")) {
			logger.info(`Processing Discord channel selection: ${data}`);
			const discordChannelId = data.split(":")[1];

			try {
				const discordChannel = dcBot.channels.cache.get(discordChannelId);

				if (!discordChannel) {
					logger.warn(`Discord channel not found: ${discordChannelId}`);
					await ctx.answerCbQuery("Channel not found. Please try again.");
					return;
				}

				// Update user state
				userState.discordChannelId = discordChannelId;
				userState.discordChannelName = (discordChannel as any).name || discordChannelId;
				userState.step = "confirm";

				// Ask for confirmation
				const keyboard = [
					[{ text: "Confirm", callback_data: "connect_confirm" }],
					[{ text: "Cancel", callback_data: "connect_cancel" }]
				];

				// Always answer the callback query first
				await ctx.answerCbQuery();

				const connectionType = userState.isThreadConnection ? "Thread Bridge" : "Channel Bridge";
				const confirmationMessage = userState.isThreadConnection
					? `${connectionType} Configuration:\nTelegram: ${userState.telegramChatName} (Thread: ${userState.telegramThreadName || userState.telegramThreadId})\nDiscord: ${userState.discordChannelName}\n\nConfirm connection?`
					: `${connectionType} Configuration:\nTelegram: ${userState.telegramChatName}\nDiscord: ${userState.discordChannelName}\n\nConfirm connection?`;

				try {
					// Edit the message if we have a message to edit
					if (userState.originalMessageId) {
						await ctx.telegram.editMessageText(
							ctx.chat?.id,
							userState.originalMessageId,
							undefined,
							confirmationMessage,
							{ reply_markup: { inline_keyboard: keyboard } }
						);
					} else {
						await ctx.editMessageText(
							confirmationMessage,
							{ reply_markup: { inline_keyboard: keyboard } }
						);
					}
				} catch (editError: any) {
					logger.error(`Error editing message: ${editError.message}`);
					// Try sending a new message instead
					await ctx.reply(
						confirmationMessage,
						{ reply_markup: { inline_keyboard: keyboard } }
					);
				}
			} catch (discordError: any) {
				logger.error(`Error processing Discord channel: ${discordError.message}`);
				await ctx.answerCbQuery("Error retrieving Discord channel information");
			}
		}
		// Handle confirmation
		else if (data === "connect_confirm") {
			logger.info(`Processing confirmation`);
			if (!userState.telegramChatId || !userState.discordChannelId) {
				logger.warn(`Missing required information for bridge creation`);
				await ctx.answerCbQuery();

				try {
					await ctx.editMessageText("Error: Missing chat information. Please try again.", {
						reply_markup: { inline_keyboard: [] }
					});
				} catch (editError: any) {
					logger.error(`Error editing message: ${editError.message}`);
				}

				userStates.delete(userId);
				return;
			}

			try {
				const bridgeResult = await createNewBridge(
					settings,
					userState.telegramChatId,
					userState.discordChannelId,
					userState.isThreadConnection ? userState.telegramThreadId : undefined,
					logger
				);

				// Always answer the callback query first
				await ctx.answerCbQuery();

				if (bridgeResult.success) {
					logger.info(`Bridge created successfully`);
					try {
						const connectionType = userState.isThreadConnection ? "Thread bridge" : "Bridge";
						const successMessage = userState.isThreadConnection
							? `${connectionType} created successfully! Telegram thread "${userState.telegramThreadName || userState.telegramThreadId}" in channel "${userState.telegramChatName}" is now connected to Discord channel "${userState.discordChannelName}"`
							: `${connectionType} created successfully! Telegram channel "${userState.telegramChatName}" is now connected to Discord channel "${userState.discordChannelName}"`;

						// Edit the message if we have a message to edit
						if (userState.originalMessageId) {
							await ctx.telegram.editMessageText(
								ctx.chat?.id,
								userState.originalMessageId,
								undefined,
								successMessage,
								{ reply_markup: { inline_keyboard: [] } }
							);

							// If we're in a group/channel, send an additional confirmation message
							if (isInOriginalChat) {
								const chatConfirmMessage = userState.isThreadConnection
									? `✅ This thread is now connected to Discord channel "${userState.discordChannelName}".`
									: `✅ This channel is now connected to Discord channel "${userState.discordChannelName}".`;
								
								await ctx.telegram.sendMessage(
									userState.telegramChatId,
									chatConfirmMessage,
									userState.isThreadConnection ? { message_thread_id: userState.telegramThreadId } : {}
								);
							}
						} else {
							await ctx.editMessageText(successMessage, { reply_markup: { inline_keyboard: [] } });
						}
					} catch (editError: any) {
						logger.error(`Error editing message: ${editError.message}`);
						// Try sending a new message instead
						const connectionType = userState.isThreadConnection ? "Thread bridge" : "Bridge";
						const successMessage = userState.isThreadConnection
							? `${connectionType} created successfully! Telegram thread "${userState.telegramThreadName || userState.telegramThreadId}" in channel "${userState.telegramChatName}" is now connected to Discord channel "${userState.discordChannelName}"`
							: `${connectionType} created successfully! Telegram channel "${userState.telegramChatName}" is now connected to Discord channel "${userState.discordChannelName}"`;
						
						await ctx.reply(successMessage);
					}

					// Reload bridges to apply changes immediately
					await reloadBridges(ctx);
				} else {
					logger.warn(`Failed to create bridge: ${bridgeResult.message}`);
					try {
						const errorMessage = `Failed to create bridge: ${bridgeResult.message}`;

						// Edit the message if we have a message to edit
						if (userState.originalMessageId) {
							await ctx.telegram.editMessageText(
								ctx.chat?.id,
								userState.originalMessageId,
								undefined,
								errorMessage,
								{ reply_markup: { inline_keyboard: [] } }
							);
						} else {
							await ctx.editMessageText(errorMessage, { reply_markup: { inline_keyboard: [] } });
						}
					} catch (editError: any) {
						logger.error(`Error editing message: ${editError.message}`);
						// Try sending a new message instead
						await ctx.reply(`Failed to create bridge: ${bridgeResult.message}`);
					}
				}
			} catch (bridgeError: any) {
				logger.error(`Error creating bridge: ${bridgeError.message}`);
				await ctx.answerCbQuery("Error creating bridge");
			}

			userStates.delete(userId);
		}
		// Handle cancellation
		else if (data === "connect_cancel") {
			logger.info(`Processing cancellation`);

			// Always answer the callback query first
			await ctx.answerCbQuery();

			try {
				const cancelMessage = "Bridge creation cancelled.";

				// Edit the message if we have a message to edit
				if (userState.originalMessageId) {
					await ctx.telegram.editMessageText(
						ctx.chat?.id,
						userState.originalMessageId,
						undefined,
						cancelMessage,
						{ reply_markup: { inline_keyboard: [] } }
					);
				} else {
					await ctx.editMessageText(cancelMessage, { reply_markup: { inline_keyboard: [] } });
				}
			} catch (editError: any) {
				logger.error(`Error editing message: ${editError.message}`);
				// Try sending a new message instead
				await ctx.reply("Bridge creation cancelled.");
			}

			userStates.delete(userId);
		} else {
			logger.warn(`Unknown callback query data: ${data}`);
			await ctx.answerCbQuery("Unknown command");
		}
	} catch (err: any) {
		logger.error(`Error in processConnectCallback: ${err?.message || "Unknown error"}`);
		logger.error(err.stack);
		try {
			await ctx.answerCbQuery("An error occurred. Please try again.");
		} catch (answerError: any) {
			logger.error(`Failed to answer callback query: ${answerError.message}`);
		}
		userStates.delete(userId);
	}
}

/**
 * Get available Discord channels where the bot is a member
 */
async function getAvailableDiscordChannels(dcBot: DiscordClient) {
	const channels: { id: string; name: string }[] = [];

	for (const guild of dcBot.guilds.cache.values()) {
		for (const channel of guild.channels.cache.values()) {
			if (channel.type === ChannelType.GuildText) {
				channels.push({
					id: channel.id,
					name: `${guild.name} - #${(channel as TextChannel).name}`
				});
			}
		}
	}

	return channels;
}

/**
 * Create a new bridge and save it to settings file
 */
async function createNewBridge(
	settings: Settings,
	telegramChatId: number,
	discordChannelId: string,
	telegramThreadId: number | undefined,
	logger: any
): Promise<{ success: boolean; message: string }> {
	try {
		// Check if bridge already exists
		const bridgeExists = settings.bridges.some(bridge => {
			if (telegramThreadId) {
				// For thread connections, check if there's already a thread mapping
				return bridge.telegram.chatId === telegramChatId && 
					   bridge.threadMap && 
					   bridge.threadMap.some((threadMap: any) => 
						   threadMap.telegram === telegramThreadId && threadMap.discord === discordChannelId
					   );
			} else {
				// For regular channel connections
				return bridge.telegram.chatId === telegramChatId && bridge.discord.channelId === discordChannelId;
			}
		});

		if (bridgeExists) {
			const connectionType = telegramThreadId ? "Thread bridge" : "Bridge";
			return { success: false, message: `${connectionType} already exists between these channels` };
		}

		if (telegramThreadId) {
			// Handle thread connection - add to existing bridge or create new one
			let existingBridge = settings.bridges.find(bridge => bridge.telegram.chatId === telegramChatId);
			
			if (existingBridge) {
				// Add thread mapping to existing bridge
				if (!existingBridge.threadMap) {
					existingBridge.threadMap = [];
				}
				
				existingBridge.threadMap.push({
					name: `Thread ${telegramThreadId}`,
					telegram: telegramThreadId,
					discord: discordChannelId
				});
				
				logger.info(`Added thread mapping to existing bridge: Telegram thread ${telegramThreadId} -> Discord channel ${discordChannelId}`);
			} else {
				// Create new bridge with thread mapping
				const newBridge: any = {
					name: `Bridge ${Math.floor(Math.random() * 10000)}`,
					direction: "both",
					telegram: {
						chatId: telegramChatId,
						relayJoinMessages: true,
						relayLeaveMessages: true,
						sendUsernames: true,
						crossDeleteOnDiscord: true
					},
					discord: {
						channelId: discordChannelId, // This will be the default channel, but thread will override
						relayJoinMessages: true,
						relayLeaveMessages: true,
						sendUsernames: true,
						crossDeleteOnTelegram: true,
						disableWebPreviewOnTelegram: false,
						useEmbeds: "auto"
					},
					threadMap: [{
						name: `Thread ${telegramThreadId}`,
						telegram: telegramThreadId,
						discord: discordChannelId
					}],
					tgThread: undefined
				};

				settings.bridges.push(newBridge);
				logger.info(`Created new bridge with thread mapping: Telegram thread ${telegramThreadId} -> Discord channel ${discordChannelId}`);
			}
		} else {
			// Create regular bridge (existing logic)
			const newBridge: any = {
				name: `Bridge ${Math.floor(Math.random() * 10000)}`,
				direction: "both",
				telegram: {
					chatId: telegramChatId,
					relayJoinMessages: true,
					relayLeaveMessages: true,
					sendUsernames: true,
					crossDeleteOnDiscord: true
				},
				discord: {
					channelId: discordChannelId,
					relayJoinMessages: true,
					relayLeaveMessages: true,
					sendUsernames: true,
					crossDeleteOnTelegram: true,
					disableWebPreviewOnTelegram: false,
					useEmbeds: "auto"
				},
				threadMap: [],
				tgThread: undefined
			};

			settings.bridges.push(newBridge);
			logger.info(`Created new regular bridge: Telegram chat ${telegramChatId} -> Discord channel ${discordChannelId}`);
		}

		// Save settings to file
		const settingsPath = path.join(__dirname, "..", "..", "..", "settings.yaml");
		const objectToSave = JSON.parse(JSON.stringify(settings));
		const yaml = jsYaml.dump(objectToSave);
		const notepadFriendlyYaml = yaml.replace(/\n/g, "\r\n");
		writeFileSync(settingsPath, notepadFriendlyYaml);

		const connectionType = telegramThreadId ? "Thread bridge" : "Bridge";
		return { success: true, message: `${connectionType} created successfully` };
	} catch (err: any) {
		logger.error(`Error creating bridge: ${err?.message || "Unknown error"}`);
		return { success: false, message: err?.message || "Unknown error" };
	}
}

/**
 * Reload bridges to apply changes immediately
 */
async function reloadBridges(ctx: TediCrossContext) {
	try {
		// Get settings and bridge map
		const settings = ctx.TediCross.settings;
		const bridgeMap = ctx.TediCross.bridgeMap;

		// Update bridge map with new bridges
		bridgeMap.bridges = settings.bridges;

		// Update maps in bridge map
		bridgeMap._discordToBridge = new Map();
		bridgeMap._telegramToBridge = new Map();

		// Populate the maps
		settings.bridges.forEach((bridge: any) => {
			const d = bridgeMap._discordToBridge.get(Number(bridge.discord.channelId)) || [];
			const t = bridgeMap._telegramToBridge.get(bridge.telegram.chatId) || [];
			bridgeMap._discordToBridge.set(Number(bridge.discord.channelId), [...d, bridge]);
			if (bridge.threadMap) {
				for (const trMap of bridge.threadMap) {
					const upBridge = {
						...bridge,
						tgThread: trMap.telegram
					};
					bridgeMap._discordToBridge.set(Number(trMap.discord), [...d, upBridge]);
				}
			}
			bridgeMap._telegramToBridge.set(bridge.telegram.chatId, [...t, bridge]);
		});

		return true;
	} catch (err: any) {
		ctx.TediCross.logger.error(`Error reloading bridges: ${err?.message || "Unknown error"}`);
		return false;
	}
}

// Register connect command callback handlers
registerCallbackHandler("tg_channel:", processConnectCallback);
registerCallbackHandler("dc_channel:", processConnectCallback);
registerCallbackHandler("connect_confirm", processConnectCallback);
registerCallbackHandler("connect_cancel", processConnectCallback);
