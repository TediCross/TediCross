import R from "ramda";
import { MessageMap } from "../MessageMap";
import { sleepOneMinute } from "../sleep";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Context } from "telegraf";
import { deleteMessage, ignoreAlreadyDeletedError } from "./helpers";
import { createFromObjFromUser } from "./From";
import { MessageEditOptions } from "discord.js";
import { Message, User } from "telegraf/typings/core/types/typegram";

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
 * @param ctx.tediCross	The TediCross object on the context
 * @param ctx.tediCross.message	The message to reply to
 * @param ctx.tediCross.message.chat	The object of the chat the message is from
 * @param ctx.tediCross.message.chat.id	ID of the chat the message is from
 */
export const chatinfo = (ctx: TediCrossContext, next: () => void) => {
	if (ctx.tediCross.message.text === "/chatinfo") {
		// Reply with the info
		ctx.reply(`chatID: ${ctx.tediCross.message.chat.id}`)
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
			.catch(ignoreAlreadyDeletedError);
	} else {
		next();
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
			.then(() => fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then(channel => channel.send(text)))
			.catch((err: any) =>
				console.error(`Could not tell Discord about a new chat member on bridge ${bridge.name}: ${err.message}`)
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
			console.error(
				`Could not tell Discord about a chat member who left on bridge ${bridge.name}: ${err.message}`
			)
		);
});

/**
 * Relays a message from Telegram to Discord
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross	The TediCross context of the message
 * @param ctx.TediCross	The global TediCross context of the message
 */
export const relayMessage = (ctx: TediCrossContext) =>
	R.forEach(async (prepared: any) => {
		try {
			// Discord doesn't handle messages longer than 2000 characters. Split it up into chunks that big
			const messageText = prepared.header + "\n" + prepared.text;
			let chunks = R.splitEvery(2000, messageText);

			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Get the channel to send to
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, prepared.bridge);

			let dcMessage = null;
			// Send the attachment first, if there is one
			if (!R.isNil(prepared.file)) {
				try {
					dcMessage = await channel.send({
						content: R.head(chunks),
						files: [prepared.file]
					});
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
			// Send the rest in serial
			dcMessage = await R.reduce(
				(p, chunk) => p.then(() => channel.send(chunk)),
				Promise.resolve(dcMessage),
				chunks
			);

			// Make the mapping so future edits can work XXX Only the last chunk is considered
			ctx.TediCross.messageMap.insert(
				MessageMap.TELEGRAM_TO_DISCORD,
				prepared.bridge,
				ctx.tediCross.messageId,
				dcMessage?.id
			);
		} catch (err: any) {
			console.error(`Could not relay a message to Discord on bridge ${prepared.bridge.name}: ${err.message}`);
		}
	})(ctx.tediCross.prepared);

/**
 * Handles message edits
 *
 * @param ctx	The Telegraf context
 */
export const handleEdits = createMessageHandler(async (ctx: TediCrossContext, bridge: any) => {
	// Function to "delete" a message on Discord
	const del = async (ctx: TediCrossContext, bridge: any) => {
		try {
			// Find the ID of this message on Discord
			const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				ctx.tediCross.message.message_id
			);

			// Get the channel to delete on
			const channel = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge);

			// Delete it on Discord
			const dp = channel.bulkDelete([dcMessageId]);

			// Delete it on Telegram
			const tp = ctx.deleteMessage();

			await Promise.all([dp, tp]);
		} catch (err: any) {
			console.error(
				`Could not cross-delete message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`
			);
		}
	};

	// Function to edit a message on Discord
	const edit = async (ctx: TediCrossContext, bridge: any) => {
		try {
			const tgMessage = ctx.tediCross.message;

			// Find the ID of this message on Discord
			const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(
				MessageMap.TELEGRAM_TO_DISCORD,
				bridge,
				tgMessage.message_id
			);

			// Wait for the Discord bot to become ready
			await ctx.TediCross.dcBot.ready;

			// Get the messages from Discord
			const dcMessage = await fetchDiscordChannel(ctx.TediCross.dcBot, bridge).then(channel =>
				channel.messages.fetch(dcMessageId)
			);

			R.forEach(async (prepared: any) => {
				// Discord doesn't handle messages longer than 2000 characters. Take only the first 2000
				const messageText = R.slice(0, 2000, prepared.header + "\n" + prepared.text);

				// Send them in serial, with the attachment first, if there is one
				await dcMessage.edit({ content: messageText, attachment: prepared.attachment } as MessageEditOptions);
			})(ctx.tediCross.prepared);
		} catch (err: any) {
			// Log it
			console.error(
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
