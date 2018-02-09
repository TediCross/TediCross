"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const Discord = require("discord.js");
const md2html = require("./md2html");
const MessageMap = require("../MessageMap");
const LatestDiscordMessageIds = require("./LatestDiscordMessageIds");
const _ = require("lodash");
const handleEmbed = require("./handleEmbed");

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
 */
function setup(dcBot, tgBot, dcUsers, messageMap) {
	// Create the map of latest message IDs and bridges
	const latestDiscordMessageIds = new LatestDiscordMessageIds("latestDiscordMessageIds.json", dcBot);

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

	// Listen for Discord messages
	dcBot.on("message", (message) => {

		// Ignore the bot's own messages
		if (message.author.id === dcBot.user.id) {
			return;
		}

		// Check if this is a request for server info
		if (message.cleanContent.toLowerCase() === `@${dcBot.user.username} chatinfo`.toLowerCase()) {
			// It is. Give it
			message.reply(
				"guild: " + message.guild.id + "\n" +
				"channel: " + message.channel.id + "\n"
			);

			// Don't process the message any further
			return;
		}

		// Get info about the sender
		const senderName = message.author.username + (Application.settings.telegram.colonAfterSenderName ? ":" : "");
		const senderId = message.author.id;

		// Store the UserID/Username mapping
		dcUsers.mapID(senderId).toUsername(senderName);

		// Check if the message is from the correct chat
		if (Application.bridgeMap.has("discord", message.channel.id)) {

			// Get the bridge this message should use
			const bridge = Application.bridgeMap.getBridge("discord", message.channel.id);

			// This is now the latest message for this bridge
			latestDiscordMessageIds.setLatest(message.id, bridge);

			// Check for attachments and pass them on
			message.attachments.forEach(({url}) => {
				tgBot.sendMessage({
					chat_id: bridge.telegram,
					text: `<b>${senderName}</b>\n<a href="${url}">${url}</a>`,
					parse_mode: "HTML"
				  })
				  .catch((err) => Application.logger.error(`[${bridge.name}] Telegram did not accept an attachment:`, err));
			});

			// Check the message for embeds
			message.embeds.forEach((embed) => {
				// Convert it to something Telegram likes
				const text = handleEmbed(embed, senderName);

				// Send it
				tgBot.sendMessage({
					text,
					chat_id: bridge.telegram,
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
					chat_id: bridge.telegram,
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

		} else if (message.channel.guild === undefined || !Application.bridgeMap.has("discord-guild", message.channel.guild.id)) {	// Check if it is the correct server
			// The message is from the wrong chat. Inform the sender that this is a private bot
			message.reply(
				"This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. "
				+ "If you wish to use TediCross yourself, please download and create an instance. "
				+ "You may join our Discord server (https://discord.gg/MfzGMzy) "
				+ "or Telegram group (https://t.me/TediCrossSupport) for help. "
				+ "See also https://github.com/Suppen/TediCross"
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
		if (!Application.bridgeMap.has("discord", newMessage.channel.id)) {
			return;
		}

		// Get the bridge
		const bridge = Application.bridgeMap.getBridge("discord", newMessage.channel.id);

		// Get the corresponding Telegram message ID
		Promise.resolve()
		  .then(() => messageMap.getCorresponding(MessageMap.DISCORD_TO_TELEGRAM, newMessage.id))
		  .then((tgMessageId) => {
			// Get info about the sender
			const senderName = newMessage.author.username + (Application.settings.telegram.colonAfterSenderName ? ":" : "");
			const senderId = newMessage.author.id;

			// Modify the message to fit Telegram
			const processedMessage = md2html(newMessage.cleanContent);

			// Send the update to Telegram
			tgBot.editMessageText({
				chat_id: bridge.telegram,
				message_id: tgMessageId,
				text: `<b>${senderName}</b>\n${processedMessage}`,
				parse_mode: "HTML"
			});
		  })
		  .catch((err) => Application.logger.error(`[${bridge.name}] Could not edit Telegram message:`, err));
	});

	// Start the Discord bot
	dcBot.login(Application.settings.discord.auth.token)
	  .catch((err) => Application.logger.error("Could not authenticate the Discord bot:", err));

	// Listen for the 'disconnected' event
	dcBot.on("disconnected", (evt) => {
		Application.logger.error("Discord bot disconnected!", evt);

		Application.bridgeMap.maps.forEach((bridge) => {
			tgBot.sendMessage({
				chat_id: bridge.telegram,
				text: "**TEDICROSS**\nThe discord side of the bot disconnected! Please check the log"
			  })
			  .catch((err) => Application.logger.error(`[${bridge.name}] Could not send message to Telegram:`, err));
		  });
	});

	// Listen for debug messages
	if (Application.settings.debug) {
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
	if (!Application.settings.discord.skipOldMessages) {

		// Wait for the bot to connect to the API
		dcBot.ready = dcBot.ready.then(() => {

			// Find the latest message IDs for all bridges
 			return Application.bridgeMap.maps.map((bridge) => ({
				bridge,
				messageId: latestDiscordMessageIds.getLatest(bridge)
			  }))
			  // Get messages which have arrived on each bridge since the bot was last shut down
			  .map(({bridge, messageId}) => {
				return dcBot.channels.get(bridge.discord.channel).fetchMessages({limit: 100, after: messageId})
				  .then((messages) => {
					_.chain(messages.array())
					  // Sort them on sending time
					  .sortBy((message) => message.createdTimestamp)
				  	  // Emit each message to let the rest of the setup handle them
					  .map((message) => dcBot.emit("message", message))
					  // Make the lodash chain actually do its stuff
					  .value();
				  })
				  .catch((err) => Application.logger.error(err));
			  });
		});
	}
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
