import { md2html } from "./md2html";
import { MessageMap } from "../MessageMap";
import { LatestDiscordMessageIds } from "./LatestDiscordMessageIds";
import { handleEmbed } from "./handleEmbed";
import { relayOldMessages } from "./relayOldMessages";
import { Bridge } from "../bridgestuff/Bridge";
import { groupSenderMessage, LastMessageSender } from "../bridgestuff/MessageGrouping";
import fs from "fs";
import path from "path";
import R from "ramda";
import { sleepOneMinute } from "../sleep";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Logger } from "../Logger";
import { BridgeMap } from "../bridgestuff/BridgeMap";
import { Telegraf } from "telegraf";
import {
	escapeHTMLSpecialChars,
	extractComponentContent,
	getDiscordDisplayName,
	ignoreAlreadyDeletedError,
	telegramReplyOptions
} from "./helpers";
import {
	Client,
	Collection,
	Message,
	MessageReferenceType,
	MessageType,
	PermissionFlagsBits,
	REST,
	Routes,
	TextChannel
} from "discord.js";
import { Settings } from "../settings/Settings";
import { InputMediaVideo, InputMediaAudio, InputMediaDocument, InputMediaPhoto } from "telegraf/types";

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
function memberCanSeeBridge(member: any, bridge: Bridge) {
	const channelIds = [bridge.discord.channelId, ...(bridge.topicBridges ?? []).map(mapping => mapping.discord)];
	return channelIds.some(channelId => {
		const channel = member.guild.channels.cache.get(channelId);
		return (
			channel?.guildId === member.guild.id &&
			(channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel) ?? false)
		);
	});
}

function bridgesForDiscordMessage(bridgeMap: BridgeMap, message: Message) {
	const direct = bridgeMap.fromDiscordChannelId(message.channel.id);
	if (direct.length > 0) return direct;
	const channel = message.channel as any;
	if (!channel.isThread?.() || !channel.parentId) return [];
	return bridgeMap
		.fromDiscordChannelId(channel.parentId)
		.filter(bridge => !bridge.topicBridges?.length && !bridge.topicBridgesAutoCreate);
}

async function bridgesForNewDiscordThread(
	bridgeMap: BridgeMap,
	message: Message,
	settings: Settings,
	tgBot: Telegraf,
	logger: Logger
) {
	const direct = bridgeMap.fromDiscordChannelId(message.channel.id);
	if (direct.length > 0) return direct;
	const channel = message.channel as any;
	if (!channel.isThread?.() || !channel.parentId) return [];
	const parents = bridgeMap.fromDiscordChannelId(channel.parentId);
	const results: Bridge[] = [];
	for (const bridge of parents) {
		if (!bridge.topicBridgesAutoCreate) {
			if (!bridge.topicBridges?.length) results.push(bridge);
			continue;
		}
		try {
			const topic = await (tgBot.telegram as any).createForumTopic(
				bridge.telegram.chatId,
				(channel.name || `Discord thread ${channel.id}`).slice(0, 128)
			);
			settings.updateBridge({
				...bridge,
				topicBridges: [
					...(bridge.topicBridges ?? []),
					{ telegram: topic.message_thread_id, discord: channel.id, name: channel.name }
				]
			});
			const updated = settings.bridges.find(item => item.name === bridge.name);
			if (updated) results.push({ ...updated, tgThread: topic.message_thread_id });
		} catch (error) {
			logger.error(`[${bridge.name}] Could not create a Telegram topic for Discord thread ${channel.id}:`, error);
		}
	}
	return results;
}

async function notifyMemberBridge(
	logger: Logger,
	tgBot: Telegraf,
	member: any,
	bridge: Bridge,
	verb: "joined" | "left"
) {
	const relaySetting = verb === "joined" ? "relayJoinMessages" : "relayLeaveMessages";
	if (!bridge.discord[relaySetting] || bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) return;
	const displayName = escapeHTMLSpecialChars(member.displayName || member.user.username);
	const username = escapeHTMLSpecialChars(member.user.username);
	try {
		await tgBot.telegram.sendMessage(
			bridge.telegram.chatId,
			`<b>${displayName} (@${username})</b> ${verb} the Discord side of the chat`,
			{ parse_mode: "HTML", message_thread_id: bridge.tgThread }
		);
	} catch (err) {
		logger.error(
			`[${bridge.name}] Could not notify Telegram about a user that ${verb} Discord`,
			(err as Error).toString()
		);
	}
}

function makeJoinLeaveFunc(logger: Logger, verb: "joined" | "left", bridgeMap: BridgeMap, tgBot: Telegraf) {
	return async function (member: any) {
		for (const bridge of bridgeMap.bridges) {
			if (memberCanSeeBridge(member, bridge)) {
				await notifyMemberBridge(logger, tgBot, member, bridge, verb);
			}
		}
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
	settings.onBridgeMapUpdate(updatedBridgeMap => {
		bridgeMap = updatedBridgeMap;
	});
	// Create the map of latest message IDs and bridges
	const latestDiscordMessageIds = new LatestDiscordMessageIds(
		logger,
		path.join(datadirPath, "latestDiscordMessageIds.json")
	);
	const useNickname = settings.discord.useNickname;
	const lastDiscordSenderByBridge = new Map<string, LastMessageSender>();

	// Make a set to keep track of where the "This is an instance of TediCross..." message has been sent the last minute
	const antiInfoSpamSet = new Set();

	// Set of server IDs. Will be filled when the bot is ready
	const knownServerIds = new Set();

	// @ts-ignore
	dcBot.commands = new Collection();

	const commandsPath = path.join(__dirname, "commands");
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".ts") || file.endsWith(".js"));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ("data" in command && "execute" in command) {
			// @ts-ignore
			dcBot.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}

	dcBot.on("interactionCreate", async interaction => {
		if (!interaction.isChatInputCommand()) return;
		// @ts-ignore
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: "There was an error while executing this command!",
					ephemeral: true
				});
			} else {
				await interaction.reply({
					content: "There was an error while executing this command!",
					ephemeral: true
				});
			}
		}
	});

	// Listen for users joining the server
	dcBot.on("guildMemberAdd", makeJoinLeaveFunc(logger, "joined", bridgeMap, tgBot));

	// Listen for users joining the server
	dcBot.on("guildMemberRemove", makeJoinLeaveFunc(logger, "left", bridgeMap, tgBot));
	dcBot.on("guildMemberUpdate", async (oldMember, newMember) => {
		for (const bridge of bridgeMap.bridges) {
			const couldSee = memberCanSeeBridge(oldMember, bridge);
			const canSee = memberCanSeeBridge(newMember, bridge);
			if (couldSee !== canSee) {
				await notifyMemberBridge(logger, tgBot, newMember, bridge, canSee ? "joined" : "left");
			}
		}
	});

	// Listen for Discord messages
	dcBot.on("messageCreate", async message => {
		// Ignore the bot's own messages
		if (message.author.id === dcBot.user?.id) {
			return;
		}

		// Get info about the sender
		const name = getDiscordDisplayName(message.member, message.author, useNickname);
		const senderName = escapeHTMLSpecialChars(name + (settings.telegram.colonAfterSenderName ? ":" : ""));

		// Check if the message is from the correct chat
		const bridges = await bridgesForNewDiscordThread(bridgeMap, message, settings, tgBot, logger);
		if (!R.isEmpty(bridges)) {
			for (const bridge of bridges) {
				// Ignore it if this is a telegram-to-discord bridge
				if (bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
					continue;
				}
				if (
					(message.author.bot && bridge.discord.ignoreBots) ||
					(message.webhookId && bridge.discord.ignoreWebhooks)
				) {
					continue;
				}
				const allowedUserIds = bridge.discord.allowedUserIds;
				if (
					(allowedUserIds.length > 0 && !allowedUserIds.includes(message.author.id)) ||
					bridge.discord.blockedUserIds.includes(message.author.id)
				) {
					continue;
				}

				// This is now the latest message for this bridge
				latestDiscordMessageIds.setLatest(message.id, bridge);

				// Check if the message is a reply and get the id of that message on Telegram
				let replyId = "0";
				const messageReference = message?.reference;

				if (typeof messageReference !== "undefined") {
					if (messageReference?.type === MessageReferenceType.Forward) {
						//forwarded message object
						const frwdMessage = message.messageSnapshots.get(messageReference?.messageId ?? "") ?? message;
						//console.log("==== discord2telegram forward ====");
						//console.log(`[${bridge.name}] ${JSON.stringify(frwdMessage, null, 2)}`);
						message.content = frwdMessage?.content ?? message.content;
						message.attachments = frwdMessage?.attachments ?? new Collection();
					} else {
						// reply
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
				}

				// console.dir(message.attachments);

				const sentTelegramMessageIds: string[] = [];
				const componentContent = extractComponentContent(message.components ?? []);
				const messageParts: string[] = [];
				if (message.cleanContent) messageParts.push(md2html(message.cleanContent, settings.telegram));
				if (componentContent.text.length) {
					messageParts.push(md2html(componentContent.text.join("\n"), settings.telegram));
				}
				for (const embed of message.embeds) {
					if (embed.data.type === "rich") messageParts.push(handleEmbed(embed, "", settings.telegram));
				}
				const poll = (message as any).poll;
				if (poll) {
					const question = poll.question?.text ?? poll.question;
					const answers = Array.from(poll.answers?.values?.() ?? poll.answers ?? []) as any[];
					messageParts.push(
						`<b>${escapeHTMLSpecialChars(String(question ?? "Poll"))}</b>\n` +
							answers
								.map(answer => `• ${escapeHTMLSpecialChars(String(answer.text ?? answer))}`)
								.join("\n")
					);
				}
				for (const sticker of message.stickers.values()) {
					const emoji = sticker.tags ? ` ${escapeHTMLSpecialChars(sticker.tags)}` : "";
					messageParts.push(`[Sticker: ${escapeHTMLSpecialChars(sticker.name)}${emoji}]`);
				}

				const galleryImageUrls = [...componentContent.imageUrls];
				for (const embed of message.embeds) {
					const imageUrl = embed.image?.url ?? embed.thumbnail?.url;
					if (!imageUrl || galleryImageUrls.includes(imageUrl)) continue;
					galleryImageUrls.push(imageUrl);
				}

				let messageCaption = "";
				const streamKey = `${bridge.name}:${bridge.tgThread ?? "general"}`;
				const grouped = groupSenderMessage(
					lastDiscordSenderByBridge,
					streamKey,
					message.author.id,
					bridge.discord.groupMessages,
					Boolean(messageReference) || messageParts.length === 0
				);
				if (messageParts.length) {
					const sender = bridge.discord.sendUsernames && !grouped ? `<b>${senderName}</b>\n` : "";
					messageCaption = sender + messageParts.join("\n\n");
				}

				// Telegram can attach a caption to a single photo or the first item of an
				// album. Use that to keep an embed's text and image together when possible.
				const captionWithGallery =
					message.attachments.size === 0 && galleryImageUrls.length > 0 && messageCaption.length <= 1024;

				if (messageParts.length && !captionWithGallery) {
					try {
						const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, messageCaption, {
							...telegramReplyOptions(replyId),
							parse_mode: "HTML",
							link_preview_options: { is_disabled: bridge.discord.disableWebPreviewOnTelegram },
							message_thread_id: bridge.tgThread
						});
						sentTelegramMessageIds.push(tgMessage.message_id.toString());
					} catch (err) {
						logger.error(`[${bridge.name}] Telegram did not accept a message`);
						logger.error(`[${bridge.name}] Failed message:`, (err as Error).toString());
					}
				}

				// Check for attachments and pass them on
				const images: InputMediaPhoto[] = [];
				const videos: InputMediaVideo[] = [];
				const audios: InputMediaAudio[] = [];
				const documents: InputMediaDocument[] = [];
				const skippedAttachments: Array<{ name: string; size: number; limit: number }> = [];
				let mediaSendFailed = false;

				const handleMediaFile = (attachment: any, type: "video" | "photo" | "audio" | "document") => {
					// Telegram fetches media from URLs supplied by bots. Its URL import
					// limits are 5 MB for photos and 20 MB for other media.
					const maxFileSize = type === "photo" ? 5_000_000 : 20_000_000;

					if (attachment.size === undefined || attachment.size <= maxFileSize) {
						const mediaFile: any = { media: { url: attachment.url, filename: attachment.name }, type };
						if (attachment.spoiler || attachment.name?.startsWith("SPOILER_")) {
							if (type === "photo" || type === "video") mediaFile.has_spoiler = true;
						}
						switch (type) {
							case "video":
								videos.push(mediaFile as InputMediaVideo);
								break;
							case "photo":
								images.push(mediaFile as InputMediaPhoto);
								break;
							case "audio":
								audios.push(mediaFile as InputMediaAudio);
								break;
							case "document":
								documents.push(mediaFile as InputMediaDocument);
								break;
						}
					} else {
						skippedAttachments.push({
							name: attachment.name || `${type} attachment`,
							size: attachment.size,
							limit: maxFileSize
						});
						logger.warn(
							`[${bridge.name}] Skipped ${type} attachment '${attachment.name}' (${attachment.size} bytes): Telegram's URL import limit is ${maxFileSize} bytes`
						);
					}
				};

				for (const attachment of message.attachments.values()) {
					const fileType: string = attachment.contentType || "";
					if (fileType.indexOf("video") >= 0) {
						handleMediaFile(attachment, "video");
					} else if (fileType.indexOf("image") >= 0) {
						handleMediaFile(attachment, "photo");
					} else if (fileType.indexOf("audio") >= 0) {
						handleMediaFile(attachment, "audio");
					} else {
						handleMediaFile(attachment, "document");
					}
				}

				const mediaArray = [];
				if (videos.length) mediaArray.push([...videos]);
				if (audios.length) mediaArray.push([...audios]);
				if (images.length) mediaArray.push([...images]);
				if (documents.length) mediaArray.push([...documents]);

				for (const oneArray of mediaArray) {
					const type = oneArray[0].type;
					for (let i = 0; i < oneArray.length; i += 10) {
						const batch = oneArray.slice(i, i + 10);
						try {
							if (batch.length > 1) {
								const sent = await tgBot.telegram.sendMediaGroup(bridge.telegram.chatId, batch, {
									...telegramReplyOptions(replyId),
									message_thread_id: bridge.tgThread
								});
								sentTelegramMessageIds.push(...sent.map(item => item.message_id.toString()));
							} else {
								let sent: any;
								switch (type) {
									case "video":
										sent = await tgBot.telegram.sendVideo(
											bridge.telegram.chatId,
											oneArray[0].media,
											{
												...telegramReplyOptions(replyId),
												message_thread_id: bridge.tgThread
											}
										);
										break;
									case "audio":
										sent = await tgBot.telegram.sendAudio(
											bridge.telegram.chatId,
											oneArray[0].media,
											{
												...telegramReplyOptions(replyId),
												message_thread_id: bridge.tgThread
											}
										);
										break;
									case "photo":
										sent = await tgBot.telegram.sendPhoto(
											bridge.telegram.chatId,
											oneArray[0].media,
											{
												...telegramReplyOptions(replyId),
												message_thread_id: bridge.tgThread
											}
										);
										break;
									case "document":
										sent = await tgBot.telegram.sendDocument(
											bridge.telegram.chatId,
											oneArray[0].media,
											{
												...telegramReplyOptions(replyId),
												message_thread_id: bridge.tgThread
											}
										);
										break;
								}
								if (sent?.message_id) sentTelegramMessageIds.push(sent.message_id.toString());
							}
						} catch (err) {
							mediaSendFailed = true;
							logger.error(
								`[${bridge.name}] Telegram did not accept ${type} attachment:`,
								(err as Error).toString()
							);
						}
					}
				}

				for (let i = 0; i < galleryImageUrls.length; i += 10) {
					const media: InputMediaPhoto[] = galleryImageUrls
						.slice(i, i + 10)
						.map(url => ({ type: "photo", media: url }));
					try {
						if (media.length > 1) {
							if (captionWithGallery && i === 0) {
								media[0].caption = messageCaption;
								media[0].parse_mode = "HTML";
							}
							const sent = await tgBot.telegram.sendMediaGroup(bridge.telegram.chatId, media, {
								...telegramReplyOptions(replyId),
								message_thread_id: bridge.tgThread
							});
							sentTelegramMessageIds.push(...sent.map(item => item.message_id.toString()));
						} else if (media.length === 1) {
							const sent = await tgBot.telegram.sendPhoto(
								bridge.telegram.chatId,
								media[0].media as string,
								{
									...telegramReplyOptions(replyId),
									...(captionWithGallery && i === 0
										? { caption: messageCaption, parse_mode: "HTML" as const }
										: {}),
									message_thread_id: bridge.tgThread
								}
							);
							sentTelegramMessageIds.push(sent.message_id.toString());
						}
					} catch (err) {
						mediaSendFailed = true;
						logger.error(
							`[${bridge.name}] Telegram did not accept component or embed images:`,
							(err as Error).toString()
						);
					}
				}

				if (skippedAttachments.length || mediaSendFailed) {
					const sizeDetails = skippedAttachments
						.map(
							file =>
								`${file.name} (${(file.size / 1_000_000).toFixed(1)} MB; limit ${(file.limit / 1_000_000).toFixed(0)} MB)`
						)
						.join(", ");
					const notice = [
						skippedAttachments.length
							? `TediCross could not send ${skippedAttachments.length === 1 ? "this file" : `${skippedAttachments.length} files`} to Telegram because they exceed Telegram's URL upload limit${sizeDetails ? `: ${sizeDetails}` : ""}.`
							: "",
						mediaSendFailed ? "Telegram rejected one or more media files." : "",
						"The original file(s) are still available in Discord."
					]
						.filter(Boolean)
						.join(" ");
					try {
						const noticeMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, notice, {
							...telegramReplyOptions(replyId),
							message_thread_id: bridge.tgThread
						});
						sentTelegramMessageIds.push(noticeMessage.message_id.toString());
					} catch (err) {
						logger.error(
							`[${bridge.name}] Could not send the media delivery notice to Telegram:`,
							(err as Error).toString()
						);
					}
				}

				for (const telegramMessageId of sentTelegramMessageIds) {
					messageMap.insert(MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id, telegramMessageId);
				}
			}
		} else if (
			R.isNil((message.channel as TextChannel).guild) ||
			!knownServerIds.has((message.channel as TextChannel).guild.id)
		) {
			// Check if it is the correct server
			// The message is from the wrong chat. Inform the sender that this is a private bot, if they have not been informed the last minute
			if (!antiInfoSpamSet.has(message.channel.id)) {
				antiInfoSpamSet.add(message.channel.id);

				if (!settings.discord.suppressThisIsPrivateBotMessage) {
					if (message.type !== MessageType.Default && message.type !== MessageType.Reply) return;

					message
						.reply(
							"This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. " +
								"If you wish to use TediCross yourself, please download and create an instance. " +
								"See https://github.com/TediCross/TediCross"
						)
						// Delete it again after some time
						.then(sleepOneMinute)
						.then((message: any) => message.delete())
						.catch(ignoreAlreadyDeletedError as any)
						.then(() => antiInfoSpamSet.delete(message.channel.id));
				} else {
					antiInfoSpamSet.delete(message.channel.id);
				}
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
		bridgesForDiscordMessage(bridgeMap, newMessage).forEach(async bridge => {
			if (
				(bridge.discord.ignoreBots && newMessage.author?.bot) ||
				(bridge.discord.ignoreWebhooks && newMessage.webhookId)
			) {
				return;
			}
			try {
				// Get the corresponding Telegram message ID
				const tgMessageIds = await messageMap.getCorresponding(
					MessageMap.DISCORD_TO_TELEGRAM,
					bridge,
					newMessage.id
				);
				if (tgMessageIds.length === 0) return;
				//console.log("d2t edit getCorresponding: " + tgMessageId);

				// Get info about the sender
				const senderName = escapeHTMLSpecialChars(
					getDiscordDisplayName(newMessage.member, newMessage.author, useNickname) +
						(settings.telegram.colonAfterSenderName ? ":" : "")
				);

				// Modify the message to fit Telegram
				const processedMessage = md2html(newMessage.cleanContent || "", settings.telegram);

				// Send the update to Telegram
				const textToSend = bridge.discord.sendUsernames
					? `<b>${senderName}</b>\n${processedMessage}`
					: processedMessage;
				await Promise.all(
					tgMessageIds.map(tgMessageId =>
						tgBot.telegram.editMessageText(bridge.telegram.chatId, +tgMessageId, undefined, textToSend, {
							parse_mode: "HTML"
						})
					)
				);
			} catch (err) {
				logger.error(`[${bridge.name}] Could not edit Telegram message:`, (err as Error).toString());
			}
		});
	});

	// Listen for deleted messages
	function onMessageDelete(message: Message): void {
		// Check if it is a relayed message
		const isFromTelegram = message.author.id === dcBot.user?.id;

		// Hand it on to the bridges
		bridgesForDiscordMessage(bridgeMap, message).forEach(async bridge => {
			// Ignore it if cross deletion is disabled
			if (!bridge.discord.crossDeleteOnTelegram) {
				return;
			}

			try {
				// Get the corresponding Telegram message IDs
				const tgMessageIds: string[] = isFromTelegram
					? await messageMap.getCorrespondingReverse(MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id)
					: await messageMap.getCorresponding(MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id);
				//console.log("d2t delete: " + tgMessageIds);
				if (bridge.discord.crossDeleteOnTelegram === "mark") {
					await Promise.all(
						tgMessageIds.map(tgMessageId =>
							tgBot.telegram.sendMessage(
								bridge.telegram.chatId,
								"⚠️ This message was deleted on Discord.",
								{
									...telegramReplyOptions(tgMessageId),
									message_thread_id: bridge.tgThread
								}
							)
						)
					);
					return;
				}
				// Try to delete them
				await Promise.all(
					tgMessageIds.map(tgMessageId => tgBot.telegram.deleteMessage(bridge.telegram.chatId, +tgMessageId))
				);
			} catch (err) {
				logger.error(`[${bridge.name}] Could not delete Telegram message:`, (err as Error).toString());
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
		.catch(err => logger.error("Could not authenticate the Discord bot:", err.toString()));

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
				logger.error(`[${bridge.name}] Could not send message to Telegram:`, (err as Error).toString());
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
			logger.error(err.toString());
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
		// Listen for Discord.js's clientReady event
		dcBot.once("clientReady", () => {
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

			const rest = new REST().setToken(settings.discord.token);

			(async () => {
				try {
					const commands = [];

					const commandsPath = path.join(__dirname, "commands");
					const commandFiles = fs
						.readdirSync(commandsPath)
						.filter(file => file.endsWith(".ts") || file.endsWith(".js"));
					for (const file of commandFiles) {
						const filePath = path.join(commandsPath, file);
						const command = require(filePath);
						if ("data" in command && "execute" in command) {
							commands.push(command.data.toJSON());
						} else {
							console.log(
								`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
							);
						}
					}

					const data = await rest.put(Routes.applicationCommands(dcBot.user!.id), { body: commands });

					// @ts-ignore
					console.log(`Successfully reloaded ${data.length} application (/) commands.`);
				} catch (error) {
					console.error(error);
				}
			})();
		});
	});

	// Relay old messages, if wanted by the user
	if (!settings.discord.skipOldMessages) {
		//@ts-ignore
		dcBot.ready = relayOldMessages(logger, dcBot, latestDiscordMessageIds, bridgeMap);
	}
}
