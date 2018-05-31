"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const Discord = require("discord.js");
const md2html = require("./md2html");
const MessageMap = require("../MessageMap");
const LatestDiscordMessageIds = require("./LatestDiscordMessageIds");
const handleEmbed = require("./handleEmbed");
const relayOldMessages = require("./relayOldMessages");
const Bridge = require("../bridgestuff/Bridge");

/***********
 * Helpers *
 ***********/

/**
 * Gets a list of bridges existing within a guild, where the bridge settings allow relaying join/leave messages
 *
 * @param {Discord.Guild} guild	The guild to get bridges for
 * @param {BridgeMap} bridgeMap	Map of the bridges that exist
 *
 * @returns {Bridge[]}	Bridges in the guild
 */
function getBridgesInGuild(guild, bridgeMap) {
	return guild.channels
		// Get the bridges corresponding to the channels in this guild
		.map(({id}) => bridgeMap.fromDiscordChannelId(id))
		// Remove the ones which are not bridged
		.filter((bridge) => bridge !== undefined);
}

/**********************
 * The setup function *
 **********************/

/**
 * Sets up the receiving of Discord messages, and relaying them to Telegram
 *
 * @param {Discord.Client} dcBot	The Discord bot
 * @param {BotAPI} tgBot	The Telegram bot
 * @param {DiscordUserMap} dcUsers	A map between discord users and their IDs
 * @param {MessageMap} messageMap	Map between IDs of messages
 * @param {BridgeMap} bridgeMap	Map of the bridges to use
 * @param {Settings} settings	Settings to use
 */
function setup(dcBot, tgBot, dcUsers, messageMap, bridgeMap, settings) {
	// Create the map of latest message IDs and bridges
	const latestDiscordMessageIds = new LatestDiscordMessageIds("latestDiscordMessageIds.json");

	// Save the bot's known users when the bot is ready
	dcBot.on("ready", () => {
		// Save the bot's usermap
		for (const [userId, {username}] of dcBot.users) {

			// Store the UserID/Username mapping
			if (username && userId) {
				dcUsers.mapID(userId).toUsername(username);
			}
		}
	});

	// Listen for presence to get name/ID mapping
	dcBot.on("presenceUpdate", (oldMember, newMember) => {
		// Get info about the user
		const userName = newMember.user.username;
		const userId = newMember.user.id;

		// Store the UserID/Username mapping
		dcUsers.mapID(userId).toUsername(userName);
	});

	// Listen for users joining the server
	dcBot.on("guildMemberAdd", (member) => {
		getBridgesInGuild(member.guild, bridgeMap)
			// Remove those which do not allow relaying join messages
			.filter((bridge) => bridge.discord.relayJoinMessages)
			// Send the join message to the corresponding Telegram chats
			.forEach((bridge) => {
			// Ignore it if this is a telegram-to-discord bridge
				if (bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
					return;
				}

				// Make the text to send
				const text = `<b>${member.displayName} (@${member.user.username})</b> joined the Discord side of the chat`;

				// Send it
				tgBot.sendMessage({
					text,
					chat_id: bridge.telegram.chatId,
					parse_mode: "HTML"
				})
					.catch((err) => Application.logger.error(`[${bridge.name}] Could not notify Telegram about a user that joined Discord`, err));
			});
	});

	// Listen for users joining the server
	dcBot.on("guildMemberRemove", (member) => {
		getBridgesInGuild(member.guild, bridgeMap)
			// Remove those which do not allow relaying leave messages
			.filter((bridge) => bridge.discord.relayLeaveMessages)
			// Send the leave message to the corresponding Telegram chats
			.forEach((bridge) => {
				// Ignore it if this is a telegram-to-discord bridge
				if (bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
					return;
				}

				// Make the text to send
				const text = `<b>${member.displayName} (@${member.user.username})</b> left the Discord side of the chat`;

				// Send it
				tgBot.sendMessage({
					text,
					chat_id: bridge.telegram.chatId,
					parse_mode: "HTML"
				})
					.catch((err) => Application.logger.error(`[${bridge.name}] Could not notify Telegram about a user that joined Discord`, err));
			});
	});

	// Listen for Discord messages
	dcBot.on("message", (message) => {

		// Ignore the bot's own messages
		if (message.author.id === dcBot.user.id) {
			return;
		}

		// Check if this is a request for server info
		if (message.channel.type === "text" && message.cleanContent.toLowerCase() === `@${dcBot.user.username} chatinfo`.toLowerCase()) {
			// It is. Give it
			message.reply(
				"serverId: " + message.guild.id + "\n" +
				"channelId: " + message.channel.id + "\n"
			);

			// Don't process the message any further
			return;
		}

		// Get info about the sender
		const senderName = message.author.username + (settings.telegram.colonAfterSenderName ? ":" : "");
		const senderId = message.author.id;

		// Store the UserID/Username mapping
		dcUsers.mapID(senderId).toUsername(senderName);

		// Check if the message is from the correct chat
		const bridge = bridgeMap.fromDiscordChannelId(message.channel.id);
		if (bridge !== undefined) {
			// Ignore it if this is a telegram-to-discord bridge
			if (bridge.direction === Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
				return;
			}

			// This is now the latest message for this bridge
			latestDiscordMessageIds.setLatest(message.id, bridge);

			// Check for attachments and pass them on
			message.attachments.forEach(({url}) => {
				tgBot.sendMessage({
					chat_id: bridge.telegram.chatId,
					text: `<b>${senderName}</b>\n<a href="${url}">${url}</a>`,
					parse_mode: "HTML"
				})
					.catch((err) => Application.logger.error(`[${bridge.name}] Telegram did not accept an attachment:`, err));
			});

			// Check the message for embeds
			message.embeds.forEach((embed) => {
				// Ignore it if it is not a "rich" embed (image, link, video, ...)
				if (embed.type !== "rich") {
					return;
				}

				// Convert it to something Telegram likes
				const text = handleEmbed(embed, senderName);

				// Send it
				tgBot.sendMessage({
					text,
					chat_id: bridge.telegram.chatId,
					parse_mode: "HTML",
					disable_web_page_preview: true
				})
					.catch((err) => Application.logger.error(`[${bridge.name}] Telegram did not accept an embed:`, err));
			});

			// Check if there is an ordinary text message
			if (message.cleanContent) {

				// Modify the message to fit Telegram
				const processedMessage = md2html(message.cleanContent);

				// Pass the message on to Telegram
				tgBot.sendMessage({
					chat_id: bridge.telegram.chatId,
					text: `<b>${senderName}</b>\n${processedMessage}`,
					parse_mode: "HTML"
				})
					.then((tgMessage) => {
						// Make the mapping so future edits can work
						messageMap.insert(MessageMap.DISCORD_TO_TELEGRAM, message.id, tgMessage.message_id);
					})
					.catch((err) => {
						Application.logger.error(`[${bridge.name}] Telegram did not accept a message:`, err);
						Application.logger.error(`[${bridge.name}] Failed message:`, err);
					});
			}

		} else if (message.channel.guild === undefined || !bridgeMap.knownDiscordServer(message.channel.guild.id)) {	// Check if it is the correct server
			// The message is from the wrong chat. Inform the sender that this is a private bot
			message.reply(
				"This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. "
				+ "If you wish to use TediCross yourself, please download and create an instance. "
				+ "You may join our Discord server (https://discord.gg/MfzGMzy) "
				+ "or Telegram group (https://t.me/TediCrossSupport) for help. "
				+ "See also https://github.com/TediCross/TediCross"
			);
		}
	});

	// Listen for message edits
	dcBot.on("messageUpdate", (oldMessage, newMessage) => {
		// Don't do anything with the bot's own messages
		if (newMessage.author.id === dcBot.user.id) {
			return;
		}

		// Ignore it if it's not from a known bridge
		const bridge = bridgeMap.fromDiscordChannelId(newMessage.channel.id);
		if (bridge === undefined) {
			return;
		}

		// Get the corresponding Telegram message ID
		Promise.resolve()
			.then(() => messageMap.getCorresponding(MessageMap.DISCORD_TO_TELEGRAM, newMessage.id))
			.then((tgMessageId) => {
				// Get info about the sender
				const senderName = newMessage.author.username + (settings.telegram.colonAfterSenderName ? ":" : "");

				// Modify the message to fit Telegram
				const processedMessage = md2html(newMessage.cleanContent);

				// Send the update to Telegram
				tgBot.editMessageText({
					chat_id: bridge.telegram.chatId,
					message_id: tgMessageId,
					text: `<b>${senderName}</b>\n${processedMessage}`,
					parse_mode: "HTML"
				});
			})
			.catch((err) => Application.logger.error(`[${bridge.name}] Could not edit Telegram message:`, err));
	});

	// Start the Discord bot
	dcBot.login(settings.discord.token)
		.catch((err) => Application.logger.error("Could not authenticate the Discord bot:", err));

	// Listen for the 'disconnected' event
	dcBot.on("disconnected", (evt) => {
		Application.logger.error("Discord bot disconnected!", evt);

		bridgeMap.bridges.forEach((bridge) => {
			tgBot.sendMessage({
				chat_id: bridge.telegram.chatId,
				text: "**TEDICROSS**\nThe discord side of the bot disconnected! Please check the log"
			})
				.catch((err) => Application.logger.error(`[${bridge.name}] Could not send message to Telegram:`, err));
		});
	});

	// Listen for errors
	dcBot.on("error", (err) => {
		if (err.code === "ECONNRESET") {
			// Lost connection to the discord servers
			Application.logger.warn("Lost connection to Discord's servers. The bot will resume when connection is reestablished, which should happen automatically. If it does not, please report this to the TediCross support channel");
		} else {
			// Unknown error. Tell the user to tell the devs
			Application.logger.error("The Discord bot ran into an error. Please post the following error message in the TediCross support channel");
			Application.logger.error(err);
		}
	});

	// Listen for debug messages
	if (settings.debug) {
		dcBot.on("debug", (str) => {
			Application.logger.log(str);
		});

		// Check the Discord bot's status every now and then
		setInterval(() => {
			if (dcBot.status !== Discord.Constants.Status.READY) {
				let actualStatus = null;
				switch (dcBot.status) {
					case Discord.Constants.Status.CONNECTING:
						actualStatus = "CONNECTING";
						break;
					case Discord.Constants.Status.RECONNECTING:
						actualStatus = "RECONNECTING";
						break;
					case Discord.Constants.Status.IDLE:
						actualStatus = "IDLE";
						break;
					case Discord.Constants.Status.NEARLY:
						actualStatus = "NEARLY";
						break;
					case Discord.Constants.Status.DISCONNETED:
						actualStatus = "DISCONNECTED";
						break;
					default:
						actualStatus = "UNKNOWN";
						break;
				}
				Application.logger.error(`Discord status not ready! Status is '${actualStatus}'`);
			}
		}, 1000);
	}

	// Make a promise which resolves when the dcBot is ready
	dcBot.ready = new Promise((resolve) => {
		// Listen for the 'ready' event
		dcBot.once("ready", () => {
			// Log the event
			Application.logger.info(`Discord: ${dcBot.user.username} (${dcBot.user.id})`);

			// Mark the bot as ready
			resolve();
		});
	});

	// Relay old messages, if wanted by the user
	if (!settings.discord.skipOldMessages) {
		dcBot.ready = relayOldMessages(dcBot, latestDiscordMessageIds, bridgeMap);
	}
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
