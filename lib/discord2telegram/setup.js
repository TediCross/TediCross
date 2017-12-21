"use strict";

/**************************
 * Import important stuff *
 **************************/

const Application = require("../Application");
const Discord = require("discord.js");
const md2html = require("./md2html");
const MessageMap = require("../MessageMap");

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
	// Save the bot's known users when the bot is ready
	dcBot.on("ready", () => {
		// Save the bot's usermap
		for (let [userId, {username}] of dcBot.users) {

			// Store the UserID/Username mapping
			if (username && userId) {
				dcUsers.mapID(userId).toUsername(username);
			}
		}
	});

	// Listen for presence to get name/ID mapping
	dcBot.on("presenceUpdate", (oldMember, newMember) => {
		// Get info about the user
		let userName = newMember.user.username;
		let userId = newMember.user.id;

		// Store the UserID/Username mapping
		dcUsers.mapID(userId).toUsername(userName);
	});

	// Listen for Discord messages
	dcBot.on("message", (message) => {

		// Check if this is a request for server info
		if (message.cleanContent.toLowerCase() === `@${dcBot.user.username} chatinfo`.toLowerCase()) {
			// It is. Give it
			message.reply(
				"channel: " + message.channel.id + "\n" +
				"guild: " + message.guild.id + "\n"
			);
			return;
		}

		// Get info about the sender
		let senderName = message.author.username + (Application.settings.telegram.colonAfterSenderName ? ":" : "");
		let senderId = message.author.id;

		// Store the UserID/Username mapping
		dcUsers.mapID(senderId).toUsername(senderName);

		// Don't do anything with the bot's own messages
		if (senderId !== dcBot.user.id) {

			// Check if the message is from the correct chat
			if (Application.bridge.has("discord", message.channel.id)) {
				const bridge = Application.bridge.getBridge("discord", message.channel.id);

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
					// Construct the text to send
					let text = `<b>${senderName}</b>\n<a href="${embed.url}">${embed.title}</a>\n`;
					if (embed.description !== undefined) {
						text = text + md2html(embed.description) + "\n";
					}
					embed.fields.forEach((field) => {
						text = (
							text +
							"\n" +
							`<b>${field.name}</b>\n` +
							field.value + "\n"
						);
					});

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
					let processedMessage = md2html(message.cleanContent);

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

			} else if (!Application.bridge.has("discord-guild", message.channel.guild.id)) {	// Check if it is the correct server
				// The message is from the wrong chat. Inform the sender that this is a private bot
				message.reply("This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. If you wish to use TediCross yourself, please download and create an instance. You may ask @Suppen on Telegram for help");
			}
		}
	});

	/**
	 * Listen for message edits
	 */
	dcBot.on("messageUpdate", (oldMessage, newMessage) => {

		// Don't do anything with the bot's own messages
		if (newMessage.author.id !== dcBot.user.id) {

			if (Application.bridge.has("discord", newMessage.channel.id)) {
				const bridge = Application.bridge.getBridge("discord", newMessage.channel.id);

				// Get the corresponding Telegram message ID
				Promise.resolve()
				  .then(() => messageMap.getCorresponding(MessageMap.DISCORD_TO_TELEGRAM, newMessage.id))
				  .then((tgMessageId) => {
					// Get info about the sender
					let senderName = newMessage.author.username + (Application.settings.telegram.colonAfterSenderName ? ":" : "");
					let senderId = newMessage.author.id;

					// Modify the message to fit Telegram
					let processedMessage = md2html(newMessage.cleanContent);

					// Send the update to Telegram
					tgBot.editMessageText({
						chat_id: bridge.telegram,
						message_id: tgMessageId,
						text: `<b>${senderName}</b>\n${processedMessage}`,
						parse_mode: "HTML"
					});
				  })
				  .catch((err) => Application.logger.error(`[${bridge.name}] Could not edit Telegram message:`, err));
			}
			// Just ignore it if it is from the wrong server
		}
	});

	// Start the Discord bot
	dcBot.login(Application.settings.discord.auth.token).catch((err) => Application.logger.error("Could not authenticate the Discord bot:", err));

	// Listen for the 'disconnected' event
	dcBot.on("disconnected", (evt) => {
		Application.logger.error("Discord bot disconnected!", evt);

		Application.bridge.map.forEach(bridge => {
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
				Application.logger.error(`Discord status not ready! Status is'${actualStatus}'`);
			}
		}, 1000);
	}

	// Make a promise which resolves when the dcBot is ready
	dcBot.ready = new Promise((resolve, reject) => {
		// Listen for the 'ready' event
		dcBot.on("ready", () => {
			// Log the event
			Application.logger.info(`Discord: ${dcBot.user.username} (${dcBot.user.id})`);

			// Mark the bot as ready
			resolve();
		});
	});
}

/*****************************
 * Export the setup function *
 *****************************/

module.exports = setup;
