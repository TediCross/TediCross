import { md2html } from "./md2html";
import { MessageMap } from "../MessageMap";
import { LatestDiscordMessageIds } from "./LatestDiscordMessageIds";
import { handleEmbed } from "./handleEmbed";
import { relayOldMessages } from "./relayOldMessages";
import { Bridge } from "../bridgestuff/Bridge";
import fs from "fs";
import path from "path";
import R from "ramda";
import { sleepOneMinute } from "../sleep";
import { fetchDiscordChannel } from "../fetchDiscordChannel";
import { Logger } from "../Logger";
import { BridgeMap } from "../bridgestuff/BridgeMap";
import { Telegraf } from "telegraf";
import { escapeHTMLSpecialChars, ignoreAlreadyDeletedError } from "./helpers";
import { Client, Collection, Message, MessageType, REST, Routes, TextChannel } from "discord.js";
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
						parse_mode: "HTML",
						message_thread_id: bridge.tgThread
					});
				} catch (err) {
					logger.error(
						`[${bridge.name}] Could not notify Telegram about a user that ${verb} Discord`,
						(err as Error).toString()
					);
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

	// Listen for Discord messages
	dcBot.on("messageCreate", async message => {
		// Ignore the bot's own messages
		if (message.author.id === dcBot.user?.id) {
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
			for (const bridge of bridges) {
				// Ignore it if this is a telegram-to-discord bridge
				if (bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
					continue;
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

				// console.dir(message.attachments);

				// Check if there is an ordinary text message
				if (message.cleanContent) {
					// Modify the message to fit Telegram
					const processedMessage = md2html(message.cleanContent, settings.telegram);

					// Pass the message on to Telegram
					try {
						const textToSend = bridge.discord.sendUsernames
							? `<b>${senderName}</b>\n${processedMessage}`
							: processedMessage;
						// if (replyId === "0" || replyId === undefined) {
						// 	const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
						// 		parse_mode: "HTML"
						// 	});
						//
						// 	// Make the mapping so future edits can work
						// 	messageMap.insert(
						// 		MessageMap.DISCORD_TO_TELEGRAM,
						// 		bridge,
						// 		message.id,
						// 		tgMessage.message_id.toString()
						// 	);
						// } else {
						const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
							reply_to_message_id: +replyId,
							parse_mode: "HTML",
							message_thread_id: bridge.tgThread
						});
						messageMap.insert(
							MessageMap.DISCORD_TO_TELEGRAM,
							bridge,
							message.id,
							tgMessage.message_id.toString()
						);
						// }
					} catch (err) {
						logger.error(`[${bridge.name}] Telegram did not accept a message`);
						logger.error(`[${bridge.name}] Failed message:`, (err as Error).toString());
					}
				}

				// NOTE: can set caption for media group if media types <= 1 - else send text in standalone message
				// For now: ignoring captions - always send as standalone message

				// Check for attachments and pass them on
				const images: InputMediaPhoto[] = [];
				const videos: InputMediaVideo[] = [];
				const audios: InputMediaAudio[] = [];
				const documents: InputMediaDocument[] = [];

				const handleMediaFile = (attachment: any, type: "video" | "photo" | "audio" | "document") => {
					const maxFileSize = type === "video" ? 20000000 : 10000000;

					if (attachment.size < maxFileSize) {
						const mediaFile = { media: { url: attachment.url, filename: attachment.name }, type };
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
						logger.error(`[${bridge.name}] Too big attachment ${type} File: ${attachment.name}`);
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
					try {
						if (oneArray.length > 1) {
							await tgBot.telegram.sendMediaGroup(bridge.telegram.chatId, oneArray, {
								reply_to_message_id: +replyId,
								message_thread_id: bridge.tgThread
							});
						} else {
							switch (type) {
								case "video":
									await tgBot.telegram.sendVideo(bridge.telegram.chatId, oneArray[0].media, {
										reply_to_message_id: +replyId,
										message_thread_id: bridge.tgThread
									});
									break;
								case "audio":
									await tgBot.telegram.sendAudio(bridge.telegram.chatId, oneArray[0].media, {
										reply_to_message_id: +replyId,
										message_thread_id: bridge.tgThread
									});
									break;
								case "photo":
									await tgBot.telegram.sendPhoto(bridge.telegram.chatId, oneArray[0].media, {
										reply_to_message_id: +replyId,
										message_thread_id: bridge.tgThread
									});
									break;
								case "document":
									await tgBot.telegram.sendDocument(bridge.telegram.chatId, oneArray[0].media, {
										reply_to_message_id: +replyId,
										message_thread_id: bridge.tgThread
									});
									break;
							}
						}
					} catch (err) {
						logger.error(
							`[${bridge.name}] Telegram did not accept ${type} attachment:`,
							(err as Error).toString()
						);
					}
				}

				// Check the message for embeds
				for (const embed of message.embeds) {
					// Ignore it if it is not a "rich" embed (image, link, video, ...)
					if (embed.data.type !== "rich") {
						continue;
					}

					// Convert it to something Telegram likes
					const text = handleEmbed(embed, senderName, settings.telegram);

					try {
						// Send it
						await tgBot.telegram.sendMessage(bridge.telegram.chatId, text, {
							reply_to_message_id: +replyId,
							parse_mode: "HTML",
							disable_web_page_preview: true,
							message_thread_id: bridge.tgThread
						});
						// }
					} catch (err) {
						logger.error(`[${bridge.name}] Telegram did not accept an embed:`, (err as Error).toString());
					}
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
				logger.error(`[${bridge.name}] Could not edit Telegram message:`, (err as Error).toString());
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
