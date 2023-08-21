import R from "ramda";
import { MessageMap } from "../MessageMap";
import { sleepOneMinute } from "../sleep";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Context } from "telegraf";
import { deleteMessage, ignoreAlreadyDeletedError } from "./helpers";
import { createFromObjFromUser } from "./From";
import { MessageEditOptions, EmbedBuilder } from "discord.js";
import { Message, User } from "telegraf/typings/core/types/typegram";

interface DiscordMessage {
	embeds?: any[];
	content?: string;
	files?: any[];
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
 * Replies to a message with info about the chat
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
 * Replies to a message with info about the thread
 *
 * @param ctx	The Telegraf context
 */
export const threadinfo = (ctx: Context) => {
	// Reply with the info
	if (ctx.message?.message_thread_id) {
		ctx.reply(`chatID: ${ctx.message.chat.id}\nthreadID: ${ctx.message.message_thread_id}`)
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

				for (const lCtx of ctxArray) {
					const lPrepared = lCtx.tediCross.prepared[0];
					if (lPrepared.header) {
						prepared.header = lPrepared.header;
					}
					if (lPrepared.hasLinks) {
						prepared.hasLinks = lPrepared.hasLinks;
					}
					if (lPrepared.text) {
						prepared.text = lPrepared.text;
					}
					if (lPrepared.file.attachment) {
						prepared.files.push(lPrepared.file);
					}
				}

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

			let dcMessage = null;
			const messageToReply = prepared.messageToReply;
			const replyId = prepared.replyId;

			const messageText = prepared.header + "\n" + prepared.text;
			const sendObject: DiscordMessage = {};

			const useEmbeds =
				(messageText.length > 2000 && prepared.bridge.discord.useEmbeds !== "never") || prepared.hasLinks;

			if (useEmbeds) {
				const text =
					prepared.text.length > 4096 ? prepared.text.substring(0, 4090) + "..." : prepared.text || " ";
				let embeds: EmbedBuilder[] = [];
				const photoEmbeds: EmbedBuilder[] = [];
				// build text embed
				embeds.push(new EmbedBuilder().setTitle(prepared.header).setDescription(text));
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

				// trying to send prepared message
				try {
					if (replyId === "0" || replyId === undefined || messageToReply === undefined) {
						dcMessage = await channel.send(sendObject);
					} else {
						dcMessage = await messageToReply.reply(sendObject);
					}
				} catch (err: any) {
					if (err.message === "Request entity too large") {
						dcMessage = await channel.send(
							`***${prepared.senderName}** on Telegram sent a file, but it was too large for Discord. If you want it, ask them to send it some other way*`
						);
					} else {
						throw err;
					}
				}
			} else {
				// old text split version when user don't want to use embeds
				let chunks = R.splitEvery(2000, messageText);
				if (!R.isNil(prepared.file)) {
					try {
						if (replyId === "0" || replyId === undefined || messageToReply === undefined) {
							dcMessage = await channel.send({
								content: R.head(chunks),
								files: prepared.files || [prepared.file]
							});
						} else {
							dcMessage = await messageToReply.reply({
								content: R.head(chunks),
								files: prepared.files || [prepared.file]
							});
						}
						chunks = R.tail(chunks);
					} catch (err: any) {
						if (err.message === "Request entity too large") {
							dcMessage = await channel.send(
								`***${prepared.senderName}** on Telegram sent a file, but it was too large for Discord. If you want it, ask them to send it some other way*`
							);
						} else {
							throw err;
						}
					}
				}
				if (replyId === "0" || replyId === undefined || messageToReply === undefined) {
					dcMessage = await R.reduce(
						(p, chunk) => p.then(() => channel.send(chunk)),
						Promise.resolve(dcMessage),
						chunks
					);
				} else {
					dcMessage = await R.reduce(
						(p, chunk) => p.then(() => messageToReply.reply(chunk)),
						Promise.resolve(dcMessage),
						chunks
					);
				}
			}

			// Make the mapping so future edits can work XXX Only the last chunk is considered
			ctx.TediCross.messageMap.insert(
				MessageMap.TELEGRAM_TO_DISCORD,
				prepared.bridge,
				ctx.tediCross.messageId,
				dcMessage?.id
			);
		} catch (err: any) {
			ctx.TediCross.logger.error(
				`Could not relay a message to Discord on bridge ${prepared.bridge.name}: ${err.message}`
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
			const [dcMessageId] = await ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				ctx.tediCross.message.message_id
			);
			//console.log("t2d delete getCorresponding: " + dcMessageId);

			// Get the channel to delete on
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge);

			// Delete it on Discord
			const dp = channel.bulkDelete([dcMessageId]);

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

			// Find the ID of this message on Discord
			const [dcMessageId] = await ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				tgMessage.message_id
			);

			// Get the messages from Discord
			const dcMessage = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge, tgMessage.message_thread_id).then(
				channel => channel.messages.fetch(dcMessageId)
			);

			R.forEach(async (prepared: any) => {
				// Discord doesn't handle messages longer than 2000 characters. Take only the first 2000
				const messageText = prepared.header + "\n" + prepared.text; //  R.slice(0, 2000,

				const sendObject: DiscordMessage = {};
				if (messageText.length > 2000 || prepared.hasLinks) {
					const text = prepared.text.length > 4096 ? prepared.text.substring(0, 4090) + "..." : prepared.text;
					const embed = new EmbedBuilder().setTitle(prepared.header).setDescription(text);
					sendObject.embeds = [embed];
				} else {
					sendObject.content = messageText;
				}

				if (!R.isNil(prepared.file)) {
					sendObject.files = prepared.files || [prepared.file];
				}

				// Send them in serial, with the attachment first, if there is one
				if (typeof dcMessage.edit !== "function") {
					ctx.TediCross.logger.error("dcMessage.edit is not a function");
				} else {
					await dcMessage.edit(sendObject as MessageEditOptions);
					// 	{
					// 	content: messageText,
					// 	attachment: prepared.attachment
					// }
					// as MessageEditOptions);
				}
			})(ctx.tediCross.prepared);
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
