import R from "ramda";
import { MessageMap } from "../MessageMap";
import { sleepOneMinute } from "../sleep";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Context } from "telegraf";
import { deleteMessage, ignoreAlreadyDeletedError } from "./helpers";
import { createFromObjFromUser } from "./From";
import { createComponentsV2Message } from "./componentsV2";
import { MessageEditOptions, EmbedBuilder, MessageFlags, AttachmentBuilder } from "discord.js";
import { Message, User } from "telegraf/types";

interface DiscordMessage {
	embeds?: any[];
	content?: string;
	files?: any[];
	components?: any[];
	flags?: MessageFlags[];
	attachments?: Array<{ id: string }>;
}

function isPayloadTooLarge(error: any): boolean {
	return (
		error?.code === 40005 ||
		error?.status === 413 ||
		/request entity too large|payload too large/i.test(String(error?.message ?? error))
	);
}

export interface TediCrossContext extends Context {
	TediCross: any;
	tediCross: {
		message: Message | any;
		file: {
			type: string;
			id: string;
			name: string;
			link?: string;
			linkError?: boolean;
			size?: number;
		};
		messageId: string;
		prepared: any;
		bridges: any;
		replyTo: any;
		text: any;
		forwardFrom: any;
		from: any;
		hasActualReference: boolean;
		hasMediaGroup?: boolean;
	};
}

/***********
 * Helpers *
 ***********/

/**
 * Makes an endware function be handled by all bridges it applies to. Curried
 *
 * @param func	The message handler to wrap
 * @param ctx	The Telegraf context
 */
const createMessageHandler = R.curry((func, ctx) => {
	// Wait for the Discord bot to become ready
	ctx.TediCross.dcBot.ready.then(() => R.forEach(bridge => func(ctx, bridge))(ctx.tediCross.bridges));
});

/*************************
 * The endware functions *
 *************************/

/**
 * Replies to a message with info about the chat for channels.
 *
 * @param ctx	The Telegraf context
 */
export const channelChatInfo = (ctx: Context, next: () => void) => {
	if ((ctx as any).update?.channel_post) {
		if ((ctx as any).update.channel_post.text?.indexOf("/chatinfo") === 0) {
			ctx.reply(`chatID: ${(ctx as any).update.channel_post.chat.id}`)
				// Wait some time
				.then(sleepOneMinute)
				// Delete the info and the command
				.then(message =>
					Promise.all([
						// Delete the info
						deleteMessage(ctx, message),
						// Delete the command
						ctx.deleteMessage()
					])
				)
				.catch(ignoreAlreadyDeletedError as any);
			return;
		}
	}
	next();
};

/**
 * Replies to a command with info about the chat
 *
 * @param ctx	The Telegraf context
 */
export const chatinfo = (ctx: Context) => {
	// Reply with the info
	ctx.reply(`chatID: ${ctx.message?.chat.id}`)
		// Wait some time
		.then(sleepOneMinute)
		// Delete the info and the command
		.then(message =>
			Promise.all([
				// Delete the info
				deleteMessage(ctx, message),
				// Delete the command
				ctx.deleteMessage()
			])
		)
		.catch(ignoreAlreadyDeletedError as any);
};

/**
 * Replies to a command with info about the thread
 *
 * @param ctx	The Telegraf context
 */
export const threadinfo = (ctx: Context) => {
	// Reply with the info
	if (ctx.message?.message_thread_id) {
		ctx.reply(`chatID: ${ctx.message.chat?.id}\nthreadID: ${ctx.message.message_thread_id}`)
			// Wait some time
			.then(sleepOneMinute)
			// Delete the info and the command
			.then(message =>
				Promise.all([
					// Delete the info
					deleteMessage(ctx, message),
					// Delete the command
					ctx.deleteMessage()
				])
			)
			.catch(ignoreAlreadyDeletedError as any);
	} else {
		ctx.reply(`Unable to detect threadID - call /threadinfo command from target thread's chat`)
			// Wait some time
			.then(sleepOneMinute)
			// Delete the info and the command
			.then(message =>
				Promise.all([
					// Delete the info
					deleteMessage(ctx, message),
					// Delete the command
					ctx.deleteMessage()
				])
			)
			.catch(ignoreAlreadyDeletedError as any);
	}
};

/**
 * Handles users joining chats
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross.message The Telegram message received
 * @param ctx.tediCross.message.new_chat_members List of the users who joined the chat
 * @param ctx.TediCross The global TediCross context of the message
 */
export const newChatMembers = createMessageHandler((ctx: TediCrossContext, bridge: any) =>
	// Notify Discord about each user
	R.forEach(user => {
		// Make the text to send
		const from = createFromObjFromUser(user as User);
		const text = `**${from.firstName} (${R.defaultTo(
			"No username",
			from.username
		)})** joined the Telegram side of the chat`;

		// Pass it on
		ctx.TediCross.dcBot.ready
			.then(() => fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then((channel: any) => channel.send(text)))
			.catch((err: any) =>
				ctx.TediCross.logger.error(
					`Could not tell Discord about a new chat member on bridge ${bridge.name}: ${err.message}`
				)
			);
	})(ctx.tediCross.message.new_chat_members)
);

/**
 * Handles users leaving chats
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross The TediCross context of the message
 * @param ctx.tediCross.message The Telegram message received
 * @param ctx.tediCross.message.left_chat_member The user object of the user who left
 * @param ctx.TediCross The global TediCross context of the message
 */
export const leftChatMember = createMessageHandler((ctx: TediCrossContext, bridge: any) => {
	// Make the text to send
	const from = createFromObjFromUser(ctx.tediCross.message.left_chat_member);
	const text = `**${from.firstName} (${R.defaultTo(
		"No username",
		from.username
	)})** left the Telegram side of the chat`;

	// Pass it on
	ctx.TediCross.dcBot.ready
		.then(() => fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then(channel => channel.send(text)))
		.catch((err: any) =>
			ctx.TediCross.logger.error(
				`Could not tell Discord about a chat member who left on bridge ${bridge.name}: ${err.message}`
			)
		);
});

const parseMediaGroup = (ctx: TediCrossContext, byTimer: boolean = false) => {
	//ctx.TediCross.logger.info(ctx.tediCross.message.media_group_id, byTimer);

	const groupIdMap = ctx.TediCross.groupIdMap;
	const groupId = ctx.tediCross.message.media_group_id;

	if (byTimer) {
		if (groupIdMap.has(groupId)) {
			const ctxArray = groupIdMap.get(groupId);
			groupIdMap.delete(groupId);
			if (ctxArray) {
				//ctx.TediCross.logger.info(`Array Length: ${ctxArray.length}`);
				const comboCtx: TediCrossContext = ctxArray[0];
				comboCtx.tediCross.hasMediaGroup = true;
				const prepared = comboCtx.tediCross.prepared[0];
				prepared.files = [];
				prepared.sourceMessageIds = ctxArray
					.map((item: TediCrossContext) => item.tediCross.messageId)
					.filter((id: string | number | undefined) => id !== undefined)
					.map(String);
				const contentTexts: string[] = [];
				const mediaNotices = new Map<string, string>();

				for (const lCtx of ctxArray) {
					const lPrepared = lCtx.tediCross.prepared[0];
					if (lPrepared.header) {
						prepared.header = lPrepared.header;
					}
					if (lPrepared.hasLinks) {
						prepared.hasLinks = lPrepared.hasLinks;
					}
					if (lPrepared.contentText !== undefined) {
						if (lPrepared.contentText) contentTexts.push(lPrepared.contentText);
						if (lPrepared.mediaNotice) {
							mediaNotices.set(lPrepared.mediaNoticeKey || lPrepared.mediaNotice, lPrepared.mediaNotice);
						}
					} else if (lPrepared.text) {
						contentTexts.push(lPrepared.text);
					}
					if (lPrepared.file?.attachment) {
						prepared.files.push(lPrepared.file);
					}
				}
				prepared.contentText = contentTexts.join("\n");
				prepared.mediaNotice = [...mediaNotices.values()].join("\n");
				prepared.text = [prepared.contentText, prepared.mediaNotice].filter(Boolean).join("\n");

				//ctx.TediCross.logger.info(`Files Array Length: ${prepared.files.length}`);

				relayMessage(comboCtx);
			}
		} else {
			//ctx.TediCross.logger.info(`No groupId: ${groupId}`);
			return;
		}
	} else {
		let ctxArray: TediCrossContext[] | undefined;
		ctxArray = groupIdMap.get(groupId);
		if (!ctxArray) ctxArray = [];
		ctxArray.push(ctx);
		groupIdMap.set(groupId, ctxArray);
	}
};

/**
 * Relays a message from Telegram to Discord
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross	The TediCross context of the message
 * @param ctx.TediCross	The global TediCross context of the message
 */
export const relayMessage = (ctx: TediCrossContext) => {
	// group mediaGroup objects - and delay them (each object comes in separate message)
	if (ctx.tediCross.message?.media_group_id) {
		if (!ctx.tediCross.hasMediaGroup) {
			parseMediaGroup(ctx);
			setTimeout(parseMediaGroup, 5000, ctx, true);
			return;
		}
	}

	R.forEach(async (prepared: any) => {
		try {
			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Get the channel to send to
			const channel = await fetchDiscordChannel(
				ctx.TediCross.dcBot,
				prepared.bridge,
				ctx.tediCross.message?.message_thread_id
			);

			const discordMessages: Array<{ id: string }> = [];
			const messageToReply = prepared.messageToReply;
			const replyId = prepared.replyId;
			const saveMessageMappings = async (messageIds: string[]) => {
				const sourceMessageIds = prepared.sourceMessageIds ?? [String(ctx.tediCross.messageId)];
				for (const sourceId of sourceMessageIds) {
					await ctx.TediCross.messageMap.replace(
						MessageMap.TELEGRAM_TO_DISCORD,
						prepared.bridge,
						sourceId,
						messageIds
					);
				}
			};
			const sendToDiscord = async (payload: any, includeReply = true) => {
				const hasReplyTarget = Boolean(
					includeReply && replyId && replyId !== "0" && messageToReply !== undefined
				);
				const replyPayload = typeof payload === "string" ? { content: payload } : payload;
				const sent = hasReplyTarget
					? await channel.send({
							...replyPayload,
							reply: { messageReference: replyId, failIfNotExists: true }
						})
					: await channel.send(payload);
				discordMessages.push(sent);
				return sent;
			};

			const messageText = prepared.header + "\n" + prepared.text;
			const sendObject: DiscordMessage = {};

			// Telegram voice notes are Ogg Opus already. Decode only to build Discord's
			// required sampled waveform, then send the original audio as a voice message.
			if (prepared.voiceDuration !== undefined && prepared.file) {
				let response: Response;
				try {
					response = await fetch(prepared.file.attachment);
				} catch {
					throw new Error("Could not download Telegram voice note");
				}
				if (!response.ok) throw new Error(`Could not download Telegram voice note: HTTP ${response.status}`);
				const audio = Buffer.from(await response.arrayBuffer());
				const { OggOpusDecoder } = await import("ogg-opus-decoder");
				const decoder = new OggOpusDecoder();
				let waveform: Buffer;
				try {
					await decoder.ready;
					const decoded = await decoder.decodeFile(audio);
					const samples = decoded.channelData[0];
					if (!samples?.length) throw new Error("Telegram voice note did not contain decodable Opus audio");
					const bucketCount = 256;
					const bucketEnergy = new Float64Array(bucketCount);
					const bucketSamples = new Uint32Array(bucketCount);
					for (let i = 0; i < samples.length; i++) {
						const bucket = Math.min(bucketCount - 1, Math.floor((i * bucketCount) / samples.length));
						bucketEnergy[bucket] += samples[i] * samples[i];
						bucketSamples[bucket]++;
					}
					waveform = Buffer.from(
						Array.from(bucketEnergy, (energy, i) =>
							Math.min(255, Math.round(Math.sqrt(energy / Math.max(1, bucketSamples[i])) * 255))
						)
					);
				} finally {
					decoder.free();
				}

				// Voice messages cannot include content or embeds. Keep sender/caption text
				// as a regular companion message, then attach the audio as a voice message.
				if (messageText.trim()) {
					const captionPayload =
						prepared.bridge.telegram.messageStyle === "componentsV2"
							? await createComponentsV2Message(ctx, prepared, false)
							: messageText;
					await sendToDiscord(captionPayload, false);
				}
				const voiceAttachment = new AttachmentBuilder(audio, { name: prepared.file.name })
					.setDuration(prepared.voiceDuration)
					.setWaveform(waveform.toString("base64"));
				const voiceMessage = await sendToDiscord({
					files: [voiceAttachment],
					flags: [MessageFlags.IsVoiceMessage]
				});
				// Make the voice post the primary mapped target so replies point to audio,
				// not its optional sender/caption companion.
				await saveMessageMappings([
					voiceMessage.id,
					...discordMessages.filter(message => message.id !== voiceMessage.id).map(message => message.id)
				]);
				return;
			}

			if (prepared.bridge.telegram.messageStyle === "componentsV2") {
				const payload = await createComponentsV2Message(ctx, prepared);
				await sendToDiscord(payload);
				await saveMessageMappings(discordMessages.map(message => message.id));
				return;
			}

			const useEmbeds =
				(messageText.length > 2000 && prepared.bridge.discord.useEmbeds !== "never") || prepared.hasLinks;

			if (useEmbeds) {
				const text =
					prepared.text.length > 4096 ? prepared.text.substring(0, 4090) + "..." : prepared.text || " ";
				let embeds: EmbedBuilder[] = [];
				const photoEmbeds: EmbedBuilder[] = [];
				// build text embed
				const embed = new EmbedBuilder().setDescription(text);
				if (prepared.header) {
					embed.setTitle(prepared.header);
				}
				embeds.push(embed);
				// process attached files
				if (!R.isNil(prepared.file)) {
					const files = prepared.files || [prepared.file];
					let resFiles = [];
					let tempPhotoUrl: string = "";
					for (const file of files) {
						// only photo attachments can be used as embeds
						if (file.description === "photo") {
							tempPhotoUrl = file.attachment;
							photoEmbeds.push(new EmbedBuilder().setImage(tempPhotoUrl));
						} else {
							resFiles.push(file);
						}
					}
					// if only 1 photo - set it into Embed
					if (photoEmbeds.length === 1) {
						embeds[0].setImage(tempPhotoUrl);
					} else {
						// if useEmbeds = always - add photos as embeds one by one
						if (prepared.bridge.discord.useEmbeds !== "auto") {
							embeds = embeds.concat(photoEmbeds);
						} else {
							resFiles = files;
						}
					}
					if (resFiles.length) {
						sendObject.files = resFiles;
					}
				}

				sendObject.embeds = embeds;

				try {
					await sendToDiscord(sendObject);
				} catch (err: any) {
					if (isPayloadTooLarge(err)) {
						await sendToDiscord(
							`***${prepared.senderName}** on Telegram sent a file that Discord could not accept because it was too large. The original is still available in Telegram; ask them to send a smaller file or raise this server's upload limit.*`
						);
					} else {
						throw err;
					}
				}
			} else {
				// old text split version when user don't want to use embeds
				const chunks = R.splitEvery(2000, messageText);
				let chunkIndex = 0;
				if (!R.isNil(prepared.file)) {
					try {
						await sendToDiscord({
							content: chunks[0] ?? "",
							files: prepared.files || [prepared.file]
						});
						chunkIndex = 1;
					} catch (err: any) {
						if (isPayloadTooLarge(err)) {
							await sendToDiscord(
								`***${prepared.senderName}** on Telegram sent a file that Discord could not accept because it was too large. The original is still available in Telegram; ask them to send a smaller file or raise this server's upload limit.*`
							);
						} else {
							throw err;
						}
					}
				}
				for (const chunk of chunks.slice(chunkIndex)) {
					await sendToDiscord(chunk);
				}
			}

			// Keep every part mapped so edits and deletions can update the whole relayed message.
			await saveMessageMappings(discordMessages.map(message => message.id));
		} catch (err: any) {
			ctx.TediCross.logger.error(
				`Could not relay a message to Discord on bridge ${prepared.bridge.name}: ${err}`
			);
		}
	})(ctx.tediCross.prepared);
};

/**
 * Handles message edits
 *
 * @param ctx	The Telegraf context
 */
export const handleEdits = createMessageHandler(async (ctx: TediCrossContext, bridge: any) => {
	// Function to "delete" a message on Discord
	const del = async (ctx: TediCrossContext, bridge: any) => {
		try {
			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Find the ID of this message on Discord
			const dcMessageIds = await ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				ctx.tediCross.message.message_id
			);
			if (dcMessageIds.length === 0) {
				ctx.TediCross.logger.warn(
					`No Discord message mapping found for Telegram message ${ctx.tediCross.message.message_id}`
				);
				return;
			}
			//console.log("t2d delete getCorresponding: " + dcMessageId);

			// Get the channel to delete on
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge);

			// Delete it on Discord
			const dp = Promise.all(
				dcMessageIds.map((id: string) => channel.messages.fetch(id).then(message => message.delete()))
			);

			// Delete it on Telegram
			const tp = ctx.deleteMessage();

			await Promise.all([dp, tp]);
		} catch (err: any) {
			ctx.TediCross.logger.error(
				`Could not cross-delete message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`
			);
		}
	};

	// Function to edit a message on Discord
	const edit = async (ctx: TediCrossContext, bridge: any) => {
		try {
			const tgMessage = ctx.tediCross.message;

			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Find the Discord messages for this Telegram message
			const dcMessageIds: string[] = await ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				tgMessage.message_id
			);
			if (dcMessageIds.length === 0) {
				ctx.TediCross.logger.warn(
					`No Discord message mapping found for Telegram message ${tgMessage.message_id}`
				);
				return;
			}

			// Get the messages from Discord
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge, tgMessage.message_thread_id);
			const dcMessages = await Promise.all(
				dcMessageIds.map((id: string) => channel.messages.fetch(id).catch(() => undefined))
			);
			const dcMessage = dcMessages.find(message => message && !message.flags.has(MessageFlags.IsVoiceMessage));
			if (!dcMessage) return;
			const relatedVoiceMessages = dcMessages.filter((message): message is NonNullable<typeof message> =>
				Boolean(message?.flags.has(MessageFlags.IsVoiceMessage))
			);
			const prepared = ctx.tediCross.prepared[0];
			const messageText = [prepared.header, prepared.text].filter(Boolean).join("\n");
			const remainingChunks: string[] = [];
			let sendObject: DiscordMessage;

			if (bridge.telegram.messageStyle === "componentsV2") {
				const componentsPayload = await createComponentsV2Message(ctx, prepared, false);
				const keptAttachments = Array.from(dcMessage.attachments.values())
					.filter(attachment => attachment.name !== "telegram-sender-avatar.jpg")
					.map(attachment => ({ id: attachment.id }));
				sendObject = { ...componentsPayload, attachments: keptAttachments } as DiscordMessage;
			} else if ((messageText.length > 2000 && bridge.discord.useEmbeds !== "never") || prepared.hasLinks) {
				const description = prepared.text || " ";
				const embed = new EmbedBuilder().setDescription(description.slice(0, 4096));
				if (prepared.header) embed.setTitle(prepared.header.slice(0, 256));
				sendObject = { content: "", embeds: [embed] };
				if (description.length > 4096) remainingChunks.push(...R.splitEvery(2000, description.slice(4096)));
			} else {
				const chunks = R.splitEvery(2000, messageText);
				sendObject = { content: chunks.shift() || "\u200b", embeds: [] };
				remainingChunks.push(...chunks);
			}

			await dcMessage.edit(sendObject as MessageEditOptions);
			const updatedIds = [dcMessage.id, ...relatedVoiceMessages.map(message => message.id)];
			for (const chunk of remainingChunks) {
				const sent = await channel.send(chunk);
				updatedIds.push(sent.id);
			}
			await Promise.all(
				dcMessages
					.filter(
						message =>
							Boolean(message) &&
							message!.id !== dcMessage.id &&
							!message!.flags.has(MessageFlags.IsVoiceMessage)
					)
					.map(message => message!.delete().catch(() => undefined))
			);
			await ctx.TediCross.messageMap.replace(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				tgMessage.message_id,
				updatedIds
			);
		} catch (err: any) {
			// Log it
			ctx.TediCross.logger.error(
				`Could not cross-edit message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`
			);
		}
	};

	// Check if this is a "delete", meaning it has been edited to a single dot
	if (
		bridge.telegram.crossDeleteOnDiscord &&
		ctx.tediCross.text.raw === "." &&
		R.isEmpty(ctx.tediCross.text.entities)
	) {
		await del(ctx, bridge);
	} else {
		await edit(ctx, bridge);
	}
});
