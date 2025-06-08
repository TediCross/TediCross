import { TediCrossContext } from "../endwares";
import { writeFileSync } from "fs";
import path from "path";
import jsYaml from "js-yaml";
import { registerCallbackHandler } from "./callbacks";

// Interface for removable items (bridges or thread mappings)
interface RemovableItem {
	type: 'bridge' | 'thread';
	bridgeName: string;
	threadIndex?: number;
	displayName: string;
	telegramChatName: string;
	discordChannelName: string;
	threadId?: number;
}

/**
 * Command to remove an existing bridge or thread mapping
 */
export async function remove(ctx: TediCrossContext) {
	const settings = ctx.TediCross.settings;
	const logger = ctx.TediCross.logger;

	try {
		// Check if command is being used in private chat
		if (!ctx.chat) {
			await ctx.reply("Error: Could not identify chat.");
			return;
		}

		if (ctx.chat.type !== "private") {
			await ctx.reply(
				"This command is only available in direct messages to the bot. Please message me directly."
			);
			return;
		}

		if (!ctx.from) {
			await ctx.reply("Error: Could not identify user.");
			return;
		}

		const userId = ctx.from.id;

		// Get existing bridges
		const bridges = settings.bridges;

		if (bridges.length === 0) {
			await ctx.reply("No bridges found to remove.");
			return;
		}

		// Find bridges where user is an admin
		const adminBridges: any[] = [];
		for (const bridge of bridges) {
			try {
				const chatId = bridge.telegram.chatId;
				const admins = await ctx.telegram.getChatAdministrators(chatId);
				const isAdmin = admins.some(admin => admin.user.id === userId);

				if (isAdmin) {
					adminBridges.push(bridge);
				}
			} catch (error) {
				// Skip chats where we can't get admin info
				continue;
			}
		}

		if (adminBridges.length === 0) {
			await ctx.reply("No bridges found where you have admin permissions.");
			return;
		}

		// Build list of removable items (bridges and thread mappings)
		const removableItems: RemovableItem[] = [];

		for (const bridge of adminBridges) {
			try {
				// Get Telegram chat name
				const telegramChat = await ctx.telegram.getChat(bridge.telegram.chatId);
				const telegramChatName = 'title' in telegramChat
					? telegramChat.title as string
					: ('username' in telegramChat
						? `@${telegramChat.username as string}`
						: `Chat ${bridge.telegram.chatId}`);

				// Get Discord channel name for main bridge
				let mainDiscordChannelName = `#${bridge.discord.channelId}`;
				try {
					const discordChannel = await ctx.TediCross.dcBot.channels.fetch(bridge.discord.channelId);
					if (discordChannel && discordChannel.name) {
						mainDiscordChannelName = `#${discordChannel.name}`;
					}
				} catch (err) {
					logger.warn(`Could not fetch Discord channel name for channel ID ${bridge.discord.channelId}`);
				}

				// Add the main bridge as removable item
				removableItems.push({
					type: 'bridge',
					bridgeName: bridge.name,
					displayName: `🌉 Bridge: ${bridge.name}`,
					telegramChatName,
					discordChannelName: mainDiscordChannelName
				});

				// Add thread mappings as separate removable items
				if (bridge.threadMap && bridge.threadMap.length > 0) {
					for (let i = 0; i < bridge.threadMap.length; i++) {
						const threadMapping = bridge.threadMap[i];
						
						// Get Discord channel name for thread mapping
						let threadDiscordChannelName = `#${threadMapping.discord}`;
						try {
							const discordChannel = await ctx.TediCross.dcBot.channels.fetch(threadMapping.discord);
							if (discordChannel && discordChannel.name) {
								threadDiscordChannelName = `#${discordChannel.name}`;
							}
						} catch (err) {
							logger.warn(`Could not fetch Discord channel name for thread mapping ${threadMapping.discord}`);
						}

						const threadName = threadMapping.name || `Thread ${threadMapping.telegram}`;
						
						removableItems.push({
							type: 'thread',
							bridgeName: bridge.name,
							threadIndex: i,
							displayName: `🧵 Thread: ${threadName}`,
							telegramChatName,
							discordChannelName: threadDiscordChannelName,
							threadId: threadMapping.telegram
						});
					}
				}
			} catch (err: any) {
				logger.warn(`Could not fetch names for bridge ${bridge.name}: ${err?.message || "Unknown error"}`);
				// Add bridge with fallback names
				removableItems.push({
					type: 'bridge',
					bridgeName: bridge.name,
					displayName: `🌉 Bridge: ${bridge.name}`,
					telegramChatName: `Chat ${bridge.telegram.chatId}`,
					discordChannelName: `#${bridge.discord.channelId}`
				});
			}
		}

		if (removableItems.length === 0) {
			await ctx.reply("No bridges or thread mappings found to remove.");
			return;
		}

		// Create a numbered list message
		let listMessage = "**Available items to remove:**\n\n";
		removableItems.forEach((item, index) => {
			const number = index + 1;
			if (item.type === 'bridge') {
				listMessage += `${number}. 🌉 **Bridge: ${item.bridgeName}**\n`;
				listMessage += `   ${item.telegramChatName} ↔ ${item.discordChannelName}\n\n`;
			} else {
				listMessage += `${number}. 🧵 **Thread: ${item.displayName.replace('🧵 Thread: ', '')}**\n`;
				listMessage += `   Thread ${item.threadId} in ${item.telegramChatName} → ${item.discordChannelName}\n\n`;
			}
		});

		listMessage += "Select the number of the item you want to remove:";

		// Create inline keyboard with just numbers (much shorter)
		const keyboard: any[][] = [];
		let currentRow: any[] = [];
		
		removableItems.forEach((item, index) => {
			const number = index + 1;
			const itemId = item.type === 'bridge' 
				? `bridge:${item.bridgeName}`
				: `thread:${item.bridgeName}:${item.threadIndex}`;
			
			currentRow.push({
				text: `${number}`,
				callback_data: `remove_item:${itemId}`
			});

			// Create rows of 5 buttons each
			if (currentRow.length === 5 || index === removableItems.length - 1) {
				keyboard.push([...currentRow]);
				currentRow = [];
			}
		});

		await ctx.reply(listMessage, { 
			reply_markup: { inline_keyboard: keyboard },
			parse_mode: 'Markdown'
		});
	} catch (err: any) {
		logger.error(`Error in remove command: ${err?.message || "Unknown error"}`);
		await ctx.reply("An error occurred while fetching bridges.");
	}
}

/**
 * Process callback queries for bridge/thread removal
 */
export async function processRemoveCallback(ctx: TediCrossContext) {
	if (!ctx.callbackQuery) return;

	// Telegraf has different types of callback queries, we need to check if it's a data query
	const callbackQuery = ctx.callbackQuery as any;
	if (!callbackQuery.data) return;

	const data = callbackQuery.data as string;
	const logger = ctx.TediCross.logger;
	const settings = ctx.TediCross.settings;

	try {
		// Handle item selection for removal
		if (data.startsWith("remove_item:")) {
			const itemData = data.substring("remove_item:".length);
			const [itemType, bridgeName, threadIndex] = itemData.split(":");

			let confirmationMessage: string;
			let confirmCallbackData: string;

			if (itemType === "bridge") {
				confirmationMessage = `Are you sure you want to remove the entire bridge "${bridgeName}"?\n\n⚠️ This will remove the bridge and ALL its thread mappings.`;
				confirmCallbackData = `confirm_remove_bridge:${bridgeName}`;
			} else if (itemType === "thread") {
				const bridge = settings.bridges.find((b: any) => b.name === bridgeName);
				const threadMapping = bridge?.threadMap?.[parseInt(threadIndex)];
				const threadName = threadMapping?.name || `Thread ${threadMapping?.telegram}`;
				
				confirmationMessage = `Are you sure you want to remove the thread mapping "${threadName}" from bridge "${bridgeName}"?\n\n📝 This will only remove this specific thread mapping, not the entire bridge.`;
				confirmCallbackData = `confirm_remove_thread:${bridgeName}:${threadIndex}`;
			} else {
				await ctx.answerCbQuery("Invalid item type");
				return;
			}

			// Ask for confirmation
			const keyboard = [
				[{ text: "Confirm", callback_data: confirmCallbackData }],
				[{ text: "Cancel", callback_data: "cancel_remove" }]
			];

			await ctx.editMessageText(confirmationMessage, {
				reply_markup: { inline_keyboard: keyboard }
			});
		}
		// Handle bridge removal confirmation
		else if (data.startsWith("confirm_remove_bridge:")) {
			const bridgeName = data.substring("confirm_remove_bridge:".length);
			const removalResult = await removeBridge(settings, bridgeName, logger);

			if (removalResult.success) {
				await ctx.editMessageText(`Bridge "${bridgeName}" and all its thread mappings have been removed successfully.`, {
					reply_markup: { inline_keyboard: [] }
				});

				// Reload bridges to apply changes immediately
				await reloadBridges(ctx);
			} else {
				await ctx.editMessageText(`Failed to remove bridge: ${removalResult.message}`, {
					reply_markup: { inline_keyboard: [] }
				});
			}
		}
		// Handle thread mapping removal confirmation
		else if (data.startsWith("confirm_remove_thread:")) {
			const [, bridgeName, threadIndexStr] = data.split(":");
			const threadIndex = parseInt(threadIndexStr);
			const removalResult = await removeThreadMapping(settings, bridgeName, threadIndex, logger);

			if (removalResult.success) {
				await ctx.editMessageText(`Thread mapping has been removed successfully from bridge "${bridgeName}".`, {
					reply_markup: { inline_keyboard: [] }
				});

				// Reload bridges to apply changes immediately
				await reloadBridges(ctx);
			} else {
				await ctx.editMessageText(`Failed to remove thread mapping: ${removalResult.message}`, {
					reply_markup: { inline_keyboard: [] }
				});
			}
		}
		// Handle cancellation
		else if (data === "cancel_remove") {
			await ctx.editMessageText("Removal cancelled.", { reply_markup: { inline_keyboard: [] } });
		}

		await ctx.answerCbQuery();
	} catch (err: any) {
		logger.error(`Error in processRemoveCallback: ${err?.message || "Unknown error"}`);
		await ctx.answerCbQuery("An error occurred. Please try again.");
	}
}

/**
 * Remove a bridge and save updated settings
 */
async function removeBridge(
	settings: any,
	bridgeName: string,
	logger: any
): Promise<{ success: boolean; message: string }> {
	try {
		// Find the bridge index
		const bridgeIndex = settings.bridges.findIndex((bridge: any) => bridge.name === bridgeName);

		if (bridgeIndex === -1) {
			return { success: false, message: "Bridge not found" };
		}

		// Remove the bridge
		settings.bridges.splice(bridgeIndex, 1);

		// Save settings to file
		const settingsPath = path.join(__dirname, "..", "..", "..", "settings.yaml");
		const objectToSave = JSON.parse(JSON.stringify(settings));
		const yaml = jsYaml.dump(objectToSave);
		const notepadFriendlyYaml = yaml.replace(/\n/g, "\r\n");
		writeFileSync(settingsPath, notepadFriendlyYaml);

		return { success: true, message: "Bridge removed successfully" };
	} catch (err: any) {
		logger.error(`Error removing bridge: ${err?.message || "Unknown error"}`);
		return { success: false, message: err?.message || "Unknown error" };
	}
}

/**
 * Remove a specific thread mapping from a bridge and save updated settings
 */
async function removeThreadMapping(
	settings: any,
	bridgeName: string,
	threadIndex: number,
	logger: any
): Promise<{ success: boolean; message: string }> {
	try {
		// Find the bridge
		const bridge = settings.bridges.find((bridge: any) => bridge.name === bridgeName);

		if (!bridge) {
			return { success: false, message: "Bridge not found" };
		}

		if (!bridge.threadMap || !Array.isArray(bridge.threadMap)) {
			return { success: false, message: "No thread mappings found in this bridge" };
		}

		if (threadIndex < 0 || threadIndex >= bridge.threadMap.length) {
			return { success: false, message: "Thread mapping index out of range" };
		}

		// Remove the specific thread mapping
		bridge.threadMap.splice(threadIndex, 1);

		// Save settings to file
		const settingsPath = path.join(__dirname, "..", "..", "..", "settings.yaml");
		const objectToSave = JSON.parse(JSON.stringify(settings));
		const yaml = jsYaml.dump(objectToSave);
		const notepadFriendlyYaml = yaml.replace(/\n/g, "\r\n");
		writeFileSync(settingsPath, notepadFriendlyYaml);

		return { success: true, message: "Thread mapping removed successfully" };
	} catch (err: any) {
		logger.error(`Error removing thread mapping: ${err?.message || "Unknown error"}`);
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

// Register remove command callback handlers
registerCallbackHandler("remove_item:", processRemoveCallback);
registerCallbackHandler("confirm_remove_bridge:", processRemoveCallback);
registerCallbackHandler("confirm_remove_thread:", processRemoveCallback);
registerCallbackHandler("cancel_remove", processRemoveCallback);
