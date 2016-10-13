'use strict';

const { BotAPI } = require('teleapiwrapper');

const settings = JSON.parse(fs.readFileSync('settings.json'));

const bot = new BotAPI(settings.telegram.auth.token);

bot.getUpdates().then((err, updates) => {
	
});
