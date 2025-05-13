import { TediCrossContext } from "../endwares";
import { writeFileSync } from "fs";
import path from "path";
import jsYaml from "js-yaml";
import { registerCallbackHandler } from "./callbacks";

/**
 * Command to remove an existing bridge
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

		// Get Telegram chat names for each bridge
		const bridgesWithNames = await Promise.all(
			adminBridges.map(async (bridge) => {
				try {
					// Get Telegram chat name
					const telegramChat = await ctx.telegram.getChat(bridge.telegram.chatId);
					const telegramChatName = 'title' in telegramChat
						? telegramChat.title as string
						: ('username' in telegramChat
							? `@${telegramChat.username as string}`
							: `Chat ${bridge.telegram.chatId}`);

					// Get Discord channel name
					let discordChannelName = `#${bridge.discord.channelId}`;
					try {
						const discordChannel = await ctx.TediCross.dcBot.channels.fetch(bridge.discord.channelId);
						if (discordChannel && discordChannel.name) {
							discordChannelName = `#${discordChannel.name}`;
						}
					} catch (err) {
						logger.warn(`Could not fetch Discord channel name for channel ID ${bridge.discord.channelId}`);
					}

					return {
						...bridge,
						telegramChatName,
						discordChannelName
					};
				} catch (err: any) {
					logger.warn(`Could not fetch names for bridge ${bridge.name}: ${err?.message || "Unknown error"}`);
					return {
						...bridge,
						telegramChatName: `Chat ${bridge.telegram.chatId}`,
						discordChannelName: `#${bridge.discord.channelId}`
					};
				}
			})
		);

		// Create inline keyboard with bridges user can manage
		const keyboard = bridgesWithNames.map(bridge => [
			{
				text: `${bridge.name} (${bridge.telegramChatName} to ${bridge.discordChannelName})`,
				callback_data: `remove_bridge:${bridge.name}`
			}
		]);

		await ctx.reply("Select a bridge to remove:", { reply_markup: { inline_keyboard: keyboard } });
	} catch (err: any) {
		logger.error(`Error in remove command: ${err?.message || "Unknown error"}`);
		await ctx.reply("An error occurred while fetching bridges.");
	}
}

/**
 * Process callback queries for bridge removal
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
		// Handle bridge selection for removal
		if (data.startsWith("remove_bridge:")) {
			const bridgeName = data.substring("remove_bridge:".length);

			// Ask for confirmation
			const keyboard = [
				[{ text: "Confirm", callback_data: `confirm_remove:${bridgeName}` }],
				[{ text: "Cancel", callback_data: "cancel_remove" }]
			];

			await ctx.editMessageText(`Are you sure you want to remove the bridge "${bridgeName}"?`, {
				reply_markup: { inline_keyboard: keyboard }
			});
		}
		// Handle removal confirmation
		else if (data.startsWith("confirm_remove:")) {
			const bridgeName = data.substring("confirm_remove:".length);
			const removalResult = await removeBridge(settings, bridgeName, logger);

			if (removalResult.success) {
				await ctx.editMessageText(`Bridge "${bridgeName}" has been removed successfully.`, {
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
		// Handle cancellation
		else if (data === "cancel_remove") {
			await ctx.editMessageText("Bridge removal cancelled.", { reply_markup: { inline_keyboard: [] } });
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
registerCallbackHandler("remove_bridge:", processRemoveCallback);
registerCallbackHandler("confirm_remove:", processRemoveCallback);
registerCallbackHandler("cancel_remove", processRemoveCallback);
