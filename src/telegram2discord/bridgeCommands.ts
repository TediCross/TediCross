import { Bridge, BridgeProperties } from "../bridgestuff/Bridge";
import { TediCrossContext } from "./endwares";

async function isBridgeManagementEnabled(ctx: TediCrossContext) {
	if (ctx.TediCross.settings.telegram.enableBridgeManagement) return true;
	await ctx.reply(
		"Bridge management is disabled. Enable `telegram.enableBridgeManagement` in the settings file to use these commands."
	);
	return false;
}

async function isChatAdmin(ctx: TediCrossContext) {
	if (!ctx.chat || !ctx.from || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return false;
	const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
	return member.status === "creator" || member.status === "administrator";
}

function getTopicId(ctx: TediCrossContext) {
	return (ctx.message as any)?.message_thread_id as number | undefined;
}

/** Connect a Telegram chat or forum topic to a Discord text channel. */
export async function connectBridge(ctx: TediCrossContext) {
	if (!(await isBridgeManagementEnabled(ctx))) return;
	if (!(await isChatAdmin(ctx))) {
		await ctx.reply("Only a group administrator can manage bridges.");
		return;
	}
	const topicId = getTopicId(ctx);
	const text = (ctx.message as any)?.text ?? "";
	const args = text
		.replace(/^\/connect(?:@\w+)?\s*/i, "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	const settings = ctx.TediCross.settings;

	if (topicId) {
		const [discordChannelId] = args;
		if (!discordChannelId) {
			await ctx.reply("Use /connect <Discord channel ID> from a forum topic.");
			return;
		}
		const bridge = settings.bridges.find((item: Bridge) => item.telegram.chatId === ctx.chat!.id);
		if (!bridge) {
			await ctx.reply("Connect this Telegram group to a Discord channel first.");
			return;
		}
		const channel = await ctx.TediCross.dcBot.channels.fetch(discordChannelId);
		if (!channel?.isTextBased() || !("guild" in channel)) {
			await ctx.reply("That ID is not an accessible Discord server text channel.");
			return;
		}
		const topicBridges = [...bridge.topicBridges.filter((item: any) => item.telegram !== topicId)];
		topicBridges.push({
			telegram: topicId,
			discord: channel.id,
			name: (ctx.message as any).forum_topic_created?.name
		});
		settings.updateBridge({ ...bridge, topicBridges });
		await ctx.reply(`Connected this topic to #${"name" in channel ? channel.name : channel.id}.`);
		return;
	}

	const [name, discordChannelId] = args;
	if (!name || !discordChannelId) {
		await ctx.reply("Use /connect <bridge name> <Discord channel ID> in the Telegram group.");
		return;
	}
	if (settings.bridges.some((bridge: Bridge) => bridge.name === name)) {
		await ctx.reply("A bridge with that name already exists.");
		return;
	}
	const channel = await ctx.TediCross.dcBot.channels.fetch(discordChannelId);
	if (!channel?.isTextBased() || !("guild" in channel)) {
		await ctx.reply("That ID is not an accessible Discord server text channel.");
		return;
	}
	const template =
		settings.bridges.find((bridge: Bridge) => bridge.telegram.chatId === ctx.chat!.id) ?? settings.bridges[0];
	if (!template) {
		await ctx.reply("Add one bridge in the settings file first so TediCross has bridge defaults to copy.");
		return;
	}
	const bridge: BridgeProperties = {
		...JSON.parse(JSON.stringify(template)),
		name,
		tgThread: undefined,
		telegram: { ...JSON.parse(JSON.stringify(template.telegram)), chatId: ctx.chat!.id },
		discord: { ...JSON.parse(JSON.stringify(template.discord)), channelId: channel.id },
		topicBridges: []
	};
	settings.addBridge(bridge);
	await ctx.reply(`Connected this Telegram group to #${"name" in channel ? channel.name : channel.id} as “${name}”.`);
}

/** Remove a topic mapping from inside the topic, or a whole bridge by name. */
export async function removeBridge(ctx: TediCrossContext) {
	if (!(await isBridgeManagementEnabled(ctx))) return;
	if (!(await isChatAdmin(ctx))) {
		await ctx.reply("Only a group administrator can manage bridges.");
		return;
	}
	const settings = ctx.TediCross.settings;
	const topicId = getTopicId(ctx);
	if (topicId) {
		const bridge = settings.bridges.find((item: Bridge) => item.telegram.chatId === ctx.chat!.id);
		if (!bridge?.topicBridges.some((item: any) => item.telegram === topicId)) {
			await ctx.reply("This topic is not connected to a Discord channel.");
			return;
		}
		settings.updateBridge({
			...bridge,
			topicBridges: bridge.topicBridges.filter((item: any) => item.telegram !== topicId)
		});
		await ctx.reply("Removed this topic mapping.");
		return;
	}
	const name = ((ctx.message as any)?.text ?? "").replace(/^\/remove(?:@\w+)?\s*/i, "").trim();
	const bridge = settings.bridges.find((item: Bridge) => item.name === name && item.telegram.chatId === ctx.chat!.id);
	if (!bridge) {
		await ctx.reply("Use /remove <bridge name> to remove one of this group's bridges.");
		return;
	}
	settings.removeBridge(bridge.name);
	await ctx.reply(`Removed bridge “${bridge.name}”.`);
}
