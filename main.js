'use strict';

const stream = require('stream');
const fs = require('fs');
const http = require('http');
const https = require('https');

const { BotAPI, InputFile } = require('teleapiwrapper');
const Discord = require('discord.io');
const updateGetter = require('./updategetter.js');

const settings = JSON.parse(fs.readFileSync('settings.json'));

const tgBot = new BotAPI(settings.telegram.auth.token);
const dcBot = new Discord.Client({
	token: settings.discord.auth.token,
	autorun: true
});

updateGetter(tgBot, settings.telegram.timeout);

// Log inits
dcBot.on('ready', () => console.log(`Discord: ${dcBot.username} (${dcBot.id})`));
tgBot.getMe().then(bot => console.log(`Telegram: ${bot.username} (${bot.id})`));

const dcUsers = JSON.parse(fs.readFileSync(settings.discord.usersfile, 'utf8'));
setInterval(() => fs.writeFile(settings.discord.usersfile, JSON.stringify(dcUsers, undefined, '\t')), 30000);

const logStream = fs.createWriteStream('debug_log.txt', { flags: 'a' });
dcBot.on('any', e => {
	if (e.t === 'GUILD_CREATE') {
		e.d.members.forEach(member => {
			dcUsers[member.user.id] = member.user.username;
		});
	}
	else if (e.t === 'MESSAGE_CREATE') {
		if(e.d.attachments) {
			e.d.attachments.forEach(attachment => {
				const req = attachment.url[4] === 's' ? https.get(attachment.url) : http.get(attachment.url);
				req.on('response', res => {
					const s = new stream.PassThrough();
					tgBot.sendPhoto({
						chat_id: settings.telegram.chat_id,
						photo: new InputFile(s, attachment.url.split('/').pop())
					});
					res.pipe(s);
				});
			});
		}
	}
	logStream.write(JSON.stringify(e, undefined, '\t') + '\n\n\n');
});
dcBot.on('presence', (user, userID) => { dcUsers[userID] = user; });
dcBot.on('message', (user, userID, channelID, message, event) => {
	dcUsers[userID] = user;
	// Ignore own messages
	if (userID !== settings.discord.botID) {
		if (settings.debug) {
			console.log(`Got message: \`${message}\` from Discord-user: ${user} (${userID})`);
		}
		tgBot.sendMessage({
			chat_id: settings.telegram.chat_id,
			text: `<b>${user}</b>: ${message
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/&/g, '&amp;')
				.replace(/\*\*([^*]+)\*\*/g, (m, b) => '<b>' + b + '</b>')
				.replace(/\*([^*]+)\*/g, (m, b) => '<i>' + b + '</i>')
				.replace(/_([^*]+)_/g, (m, b) => '<i>' + b + '</i>')
				.replace(/<@!(\d+)>/g, (m, id) => {
					if (dcUsers[id]) {
						return `@${dcUsers[id]}`;
					} else {
						return m;
					}
				})}`,
			parse_mode: 'HTML'
		});
	}
});

tgBot.on('text', message => {
	if (settings.debug) {
		console.log(`Got message: \`${message.text}\` from Telegram-user: ${message.from.username || message.from.first_name} (${message.from.id})`);
	}
	dcBot.sendMessage({
		to: settings.discord.channelID,
		message: `${message.from.username || message.from.first_name}: ${message.text}`
	});
});

if (settings.debug) {
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', data => {
		data = data.trim();
		switch (data) {
			case 'exit':
				process.stdin.pause();
				console.log('Exiting...');
				break;
			case 'help':
				console.log(
`Available commands:
	help - this
	exit - exit application`
				);
				break;
			default:
				break;
		}
	});
}

