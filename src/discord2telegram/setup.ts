import { md2html } from "./md2html";
import { MessageMap } from "../MessageMap";
import { LatestDiscordMessageIds } from "./LatestDiscordMessageIds";
import { handleEmbed } from "./handleEmbed";
import { relayOldMessages } from "./relayOldMessages";
import { Bridge } from "../bridgestuff/Bridge";
import path from "path";
import R from "ramda";
import { sleepOneMinute } from "../sleep";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Logger } from "../Logger";
import { BridgeMap } from "../bridgestuff/BridgeMap";
import { Telegraf } from "telegraf";
import { escapeHTMLSpecialChars, ignoreAlreadyDeletedError } from "./helpers";
import { Client, Message, TextChannel } from "discord.js";
import { Settings } from "../settings/Settings";

/***********
 * Helpers *
 ***********/

/**
 * Creates a function to give to 'guildMemberAdd' or 'guildMemberRemove' on a Discord bot
 *
 * @param logger The Logger instance to log messages to
 * @param verb Either "joined" or "left"
 * @param bridgeMap Map of existing bridges
 * @param tgBot The Telegram bot to send the messages to
 *
 * @returns Function which can be given to the 'guildMemberAdd' or 'guildMemberRemove' events of a Discord bot
 *
 * @private
 */
function makeJoinLeaveFunc(logger: Logger, verb: "joined" | "left", bridgeMap: BridgeMap, tgBot: Telegraf) {
	// Find out which setting property to check the bridges for
	const relaySetting = verb === "joined" ? "relayJoinMessages" : "relayLeaveMessages";
	return function (member: any) {
		// Get the bridges in the guild the member joined/left
		member.guild.channels.cache
			// Get the bridges corresponding to the channels in this guild
			.map(({ id }: { id: number }) => bridgeMap.fromDiscordChannelId(id))
			// Remove the ones which are not bridged
			.filter((bridges: any) => bridges !== undefined)
			// Flatten the bridge arrays
			.reduce((flattened: any, bridges: any) => flattened.concat(bridges))
			// Remove those which do not allow relaying join messages
			.filter((bridge: any) => bridge.discord[relaySetting])
			// Ignore the T2D bridges
			.filter((bridge: any) => bridge.direction !== Bridge.DIRECTION_TELEGRAM_TO_DISCORD)
			.forEach(async (bridge: any) => {
				// Make the text to send
				const text = `<b>${member.displayName} (@${member.user.username})</b> ${verb} the Discord side of the chat`;

				try {
					// Send it
					await tgBot.telegram.sendMessage(bridge.telegram.chatId, text, {
						parse_mode: "HTML"
					});
				} catch (err) {
					logger.error(`[${bridge.name}] Could not notify Telegram about a user that ${verb} Discord`, err);
				}
			});
	};
}

/**********************
 * The setup function *
 **********************/

/**
 * Sets up the receiving of Discord messages, and relaying them to Telegram
 *
 * @param logger The Logger instance to log messages to
 * @param dcBot The Discord bot
 * @param tgBot The Telegram bot
 * @param messageMap Map between IDs of messages
 * @param bridgeMap Map of the bridges to use
 * @param settings Settings to use
 * @param datadirPath Path to the directory to put data files in
 */
export function setup(
	logger: Logger,
	dcBot: Client,
	tgBot: Telegraf,
	messageMap: MessageMap,
	bridgeMap: BridgeMap,
	settings: Settings,
	datadirPath: string
) {
	// Create the map of latest message IDs and bridges
	const latestDiscordMessageIds = new LatestDiscordMessageIds(
		logger,
		path.join(datadirPath, "latestDiscordMessageIds.json")
	);
	const useNickname = settings.discord.useNickname;

	// Make a set to keep track of where the "This is an instance of TediCross..." message has been sent the last minute
	const antiInfoSpamSet = new Set();

	// Set of server IDs. Will be filled when the bot is ready
	const knownServerIds = new Set();

	// Listen for users joining the server
	dcBot.on("guildMemberAdd", makeJoinLeaveFunc(logger, "joined", bridgeMap, tgBot));

	// Listen for users joining the server
	dcBot.on("guildMemberRemove", makeJoinLeaveFunc(logger, "left", bridgeMap, tgBot));

	// Listen for Discord messages
	dcBot.on("messageCreate", async message => {
		// Ignore the bot's own messages
		if (message.author.id === dcBot.user?.id) {
			return;
		}

		// Check if this is a request for server info
		if (message.cleanContent === "/chatinfo") {
			// It is. Give it
			message
				.reply("\nchannelId: '" + message.channel.id + "'")
				.then(sleepOneMinute)
				.then((info: any) => Promise.all([info.delete(), message.delete()]))
				.catch(ignoreAlreadyDeletedError);

			// Don't process the message any further
			return;
		}

		// Get info about the sender
		const senderName = R.compose<any, any>(
			// Make it HTML safe
			escapeHTMLSpecialChars,
			// Add a colon if wanted
			//@ts-ignore
			R.when(R.always(settings.telegram.colonAfterSenderName), senderName => senderName + ":"),
			// Figure out what name to use
			R.ifElse(
				message => useNickname && !R.isNil(message.member),
				R.path(["member", "displayName"]),
				R.path(["author", "username"])
			)
		)(message) as string;

		// Check if the message is from the correct chat
		const bridges = bridgeMap.fromDiscordChannelId(Number(message.channel.id));
		if (!R.isEmpty(bridges)) {
			bridges.forEach(async bridge => {
				// Ignore it if this is a telegram-to-discord bridge
				if (bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
					return;
				}

				// This is now the latest message for this bridge
				latestDiscordMessageIds.setLatest(message.id, bridge);

				// Check if the message is a reply and get the id of that message on Telegram
				let replyId = "0";
				const messageReference = message?.reference;

				if (typeof messageReference !== "undefined") {
					const referenceId = messageReference?.messageId;
					if (typeof referenceId !== "undefined") {
						//console.log("==== discord2telegram reply ====");
						//console.log("referenceId: " + referenceId);
						//console.log("bridge.name: " + bridge.name);
						[replyId] = await messageMap.getCorrespondingReverse(
							MessageMap.TELEGRAM_TO_DISCORD,
							bridge,
							referenceId as string
						);
						//console.log("t2d replyId: " + replyId);
						if (replyId === undefined) {
							[replyId] = await messageMap.getCorresponding(
								MessageMap.DISCORD_TO_TELEGRAM,
								bridge,
								referenceId as string
							);
							//console.log("d2t replyId: " + replyId);
						}
					}
				}

				// Check for attachments and pass them on
				message.attachments.forEach(async ({ url }) => {
					try {
						const textToSend = bridge.discord.sendUsernames
							? `<b>${senderName}</b>\n<a href="${url}">${url}</a>`
							: `<a href="${url}">${url}</a>`;
						if (replyId === "0" || replyId === undefined) {
							const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
								parse_mode: "HTML"
							});
							messageMap.insert(
								MessageMap.DISCORD_TO_TELEGRAM,
								bridge,
								message.id,
								tgMessage.message_id.toString()
							);
						} else {
							const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
								reply_to_message_id: +replyId,
								parse_mode: "HTML"
							});
							messageMap.insert(
								MessageMap.DISCORD_TO_TELEGRAM,
								bridge,
								message.id,
								tgMessage.message_id.toString()
							);
						}
					} catch (err) {
						logger.error(`[${bridge.name}] Telegram did not accept an attachment:`, err);
					}
				});

				// Check the message for embeds
				message.embeds.forEach(embed => {
					// Ignore it if it is not a "rich" embed (image, link, video, ...)
					if (embed.data.type !== "rich") {
						return;
					}

					// Convert it to something Telegram likes
					const text = handleEmbed(embed, senderName, settings.telegram);

					try {
						// Send it
						if (replyId === "0" || replyId === undefined) {
							tgBot.telegram.sendMessage(bridge.telegram.chatId, text, {
								parse_mode: "HTML",
								disable_web_page_preview: true
							});
						} else {
							tgBot.telegram.sendMessage(bridge.telegram.chatId, text, {
								reply_to_message_id: +replyId,
								parse_mode: "HTML",
								disable_web_page_preview: true
							});
						}
					} catch (err) {
						logger.error(`[${bridge.name}] Telegram did not accept an embed:`, err);
					}
				});

				// Check if there is an ordinary text message
				if (message.cleanContent) {
					// Modify the message to fit Telegram
					const processedMessage = md2html(message.cleanContent, settings.telegram);

					// Pass the message on to Telegram
					try {
						const textToSend = bridge.discord.sendUsernames
							? `<b>${senderName}</b>\n${processedMessage}`
							: processedMessage;
						if (replyId === "0" || replyId === undefined) {
							const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
								parse_mode: "HTML"
							});

							// Make the mapping so future edits can work
							messageMap.insert(
								MessageMap.DISCORD_TO_TELEGRAM,
								bridge,
								message.id,
								tgMessage.message_id.toString()
							);
						} else {
							const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
								reply_to_message_id: +replyId,
								parse_mode: "HTML"
							});
							messageMap.insert(
								MessageMap.DISCORD_TO_TELEGRAM,
								bridge,
								message.id,
								tgMessage.message_id.toString()
							);
						}
					} catch (err) {
						logger.error(`[${bridge.name}] Telegram did not accept a message:`, err);
						logger.error(`[${bridge.name}] Failed message:`, err);
					}
				}
			});
		} else if (
			R.isNil((message.channel as TextChannel).guild) ||
			!knownServerIds.has((message.channel as TextChannel).guild.id)
		) {
			// Check if it is the correct server
			// The message is from the wrong chat. Inform the sender that this is a private bot, if they have not been informed the last minute
			if (!antiInfoSpamSet.has(message.channel.id)) {
				antiInfoSpamSet.add(message.channel.id);

				message
					.reply(
						"This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. " +
							"If you wish to use TediCross yourself, please download and create an instance. " +
							"See https://github.com/TediCross/TediCross"
					)
					// Delete it again after some time
					.then(sleepOneMinute)
					.then((message: any) => message.delete())
					.catch(ignoreAlreadyDeletedError)
					.then(() => antiInfoSpamSet.delete(message.channel.id));
			}
		}
	});

	// Listen for message edits
	dcBot.on("messageUpdate", async (_oldMessage, newMessage) => {
		// Don't do anything with the bot's own messages
		if (newMessage.author?.id === dcBot.user?.id) {
			return;
		}

		// Pass it on to the bridges
		bridgeMap.fromDiscordChannelId(Number(newMessage.channel.id)).forEach(async bridge => {
			try {
				// Get the corresponding Telegram message ID
				const [tgMessageId] = await messageMap.getCorresponding(
					MessageMap.DISCORD_TO_TELEGRAM,
					bridge,
					newMessage.id
				);
				//console.log("d2t edit getCorresponding: " + tgMessageId);

				// Get info about the sender
				const senderName =
					(useNickname && newMessage.member ? newMessage.member.displayName : newMessage.author?.username) +
					(settings.telegram.colonAfterSenderName ? ":" : "");

				// Modify the message to fit Telegram
				const processedMessage = md2html(newMessage.cleanContent || "", settings.telegram);

				// Send the update to Telegram
				const textToSend = bridge.discord.sendUsernames
					? `<b>${senderName}</b>\n${processedMessage}`
					: processedMessage;
				await tgBot.telegram.editMessageText(bridge.telegram.chatId, +tgMessageId, undefined, textToSend, {
					parse_mode: "HTML"
				});
			} catch (err) {
				logger.error(`[${bridge.name}] Could not edit Telegram message:`, err);
			}
		});
	});

	// Listen for deleted messages
	function onMessageDelete(message: Message): void {
		// Check if it is a relayed message
		const isFromTelegram = message.author.id === dcBot.user?.id;

		// Hand it on to the bridges
		bridgeMap.fromDiscordChannelId(Number(message.channel.id)).forEach(async bridge => {
			// Ignore it if cross deletion is disabled
			if (!bridge.discord.crossDeleteOnTelegram) {
				return;
			}

			try {
				// Get the corresponding Telegram message IDs
				const tgMessageIds = isFromTelegram
					? await messageMap.getCorrespondingReverse(MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id)
					: await messageMap.getCorresponding(MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id);
				//console.log("d2t delete: " + tgMessageIds);
				// Try to delete them
				await Promise.all(
					tgMessageIds.map(tgMessageId => tgBot.telegram.deleteMessage(bridge.telegram.chatId, +tgMessageId))
				);
			} catch (err) {
				logger.error(`[${bridge.name}] Could not delete Telegram message:`, err);
				logger.warn(
					'If the previous message was a result of a message being "deleted" on Telegram, you can safely ignore it'
				);
			}
		});
	}
	dcBot.on("messageDelete", onMessageDelete as any);
	dcBot.on("messageDeleteBulk", messages => [...messages.values()].forEach(onMessageDelete as any));

	// Start the Discord bot
	dcBot
		.login(settings.discord.token)
		// Complain if it could not authenticate for some reason
		.catch(err => logger.error("Could not authenticate the Discord bot:", err));

	// Listen for the 'disconnected' event
	dcBot.on("disconnected", async evt => {
		logger.error("Discord bot disconnected!", evt);

		bridgeMap.bridges.forEach(async bridge => {
			try {
				await tgBot.telegram.sendMessage(
					bridge.telegram.chatId,
					"**TEDICROSS**\nThe discord side of the bot disconnected! Please check the log"
				);
			} catch (err) {
				logger.error(`[${bridge.name}] Could not send message to Telegram:`, err);
			}
		});
	});

	// Listen for errors
	dcBot.on("error", (err: Error) => {
		//@ts-ignore
		if (err.code === "ECONNRESET") {
			// Lost connection to the discord servers
			logger.warn(
				"Lost connection to Discord's servers. The bot will resume when connection is reestablished, which should happen automatically. If it does not, please report this to the TediCross support channel"
			);
		} else {
			// Unknown error. Tell the user to tell the devs
			logger.error(
				"The Discord bot ran into an error. Please post the following error message in the TediCross support channel"
			);
			logger.error(err);
		}
	});

	// Listen for debug messages
	if (settings.debug) {
		dcBot.on("debug", str => {
			logger.log(str);
		});
	}

	// Make a promise which resolves when the dcBot is ready
	//@ts-ignore
	dcBot.ready = new Promise<void>(resolve => {
		// Listen for the 'ready' event
		dcBot.once("ready", () => {
			// Log the event
			logger.info(`Discord: ${dcBot.user?.username} (${dcBot.user?.id})`);

			// Get the server IDs from the channels
			R.compose(
				// Mark the bot as ready
				R.andThen(() => resolve()),
				// Add them to the known server ID set
				//@ts-ignore
				R.andThen(R.reduce((knownServerIds, serverId) => knownServerIds.add(serverId), knownServerIds)),
				// Remove the invalid channels
				R.andThen(R.filter(R.complement(R.isNil))),
				// Extract the server IDs from the channels
				R.andThen(R.map(R.path(["value", "guild", "id"]))),
				// Remove those which failed
				R.andThen(R.filter(R.propEq("status", "fulfilled"))),
				// Wait for the channels to be fetched
				Promise.allSettled.bind(Promise),
				// Get the channels
				R.map(bridge => fetchDiscordChannel(dcBot, bridge)),
				// Get the bridges
				R.prop("bridges")
			)(bridgeMap);
		});
	});

	// Relay old messages, if wanted by the user
	if (!settings.discord.skipOldMessages) {
		//@ts-ignore
		dcBot.ready = relayOldMessages(logger, dcBot, latestDiscordMessageIds, bridgeMap);
	}
}
