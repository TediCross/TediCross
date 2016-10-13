'use strict';

const fs = require('fs');

const { BotAPI } = require('teleapiwrapper');
const Discord = require('discord.io');
const updateGetter = require('./updategetter.js');

const settings = JSON.parse(fs.readFileSync('settings.json'));

const tgBot = new BotAPI(settings.telegram.auth.token);

const tgBotUpdates = updateGetter(tgBot, settings.telegram.timeout);

tgBotUpdates.on('update', update => {
	console.log(update);
});

if (settings.debug.port) {
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', data => {
		data = data.trim();
		switch (data) {
			case 'exit':
				tgBotUpdates.stop();
				process.stdin.pause();
				console.log('Exiting...');
				break;
			default:
				break;
		}
			
	});
}
