TediCross
=========
TediCross is a bot which bridges a chat in [Telegram](https://telegram.org) with a channel in [Discord](https://discordapp.com/).

There is no public TediCross bot. You need to host it yourself. One bot per bridge. To host a bot, you need [nodejs](https://nodejs.org). Version 7 has been tested, but it probably works for v4 and up.


Step by step:
-------------
 1. Install nodejs
 2. Clone this git repo
 3. Enter the repo
 4. `npm install`
 5. Copy the file `example.settings.json` to `settings.json`
 6. Aquire a bot token for telegram ([How to create a Telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)) and put it in the settings file
 7. Aquire a bot token for Discord ([How to create a Discord bot](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token)) and put it in the settings file
 8. Add the Telegram bot to the Telegram chat
 9. Add the Discord bot to the Discord server (https://discordapp.com/oauth2/authorize?&client_id=YOUR_CLIENT_ID_HERE&scope=bot&permissions=0)
 10. Start TediCross: `npm start`
 11. Ask the bots for the remaining details. In the Telegram chat and the Discord channel, write `@<botname> chatinfo`. Put the info you get in the settings file
 12. Restart TediCross

Done! You now have a nice bridge between a Telegram chat and a Discord channel


### Questions?
If you need any help, ask @Suppen on Telegram. If you have feature requests or bug reports, file an issue in this repo.

