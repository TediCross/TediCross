TediCross
=========
TediCross is a bot which bridges a chat in [Telegram](https://telegram.org) with a channel in [Discord](https://discordapp.com/).

There is no public TediCross bot. You need to host it yourself. One bot per bridge. To host a bot, you need [nodejs](https://nodejs.org). Version 7 has been tested, but it probably works for v4 and up.


Features & known bugs
---------------------

Currently, the bot is able to relay ordinary text messages from Telegram to Discord and vice versa. Formatting of the messages, like @-mentions, inline- and block-style code, URLs etc. work.

Sending images works from Telegram to Discord, but not the other way. It will eventually work both ways

For a list of known bugs, or to submit a bug or feature request, see this repo's "Issues" tab


Step by step installation:
-------------
 1. Install [nodejs](https://nodejs.org)
 2. Clone this git repo
 3. Enter the repo
 4. `npm install`
 5. Copy the file `example.settings.json` to `settings.json`
 6. Aquire a bot token for Telegram ([How to create a Telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)) and put it in the settings file
   - The Telegram bot must be able to access all messages. Talk to @BotFather to disable privacy mode for the bot
 7. Aquire a bot token for Discord ([How to create a Discord bot](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token)) and put it in the settings file
 8. Add the Telegram bot to the Telegram chat
   - If the Telegram chat is a supergroup, the bot also needs to be admin of the group, or it won't get the messages. The creator of the supergroup is able to give it admin rights
 9. Add the Discord bot to the Discord server (https://discordapp.com/oauth2/authorize?&client_id=YOUR_CLIENT_ID_HERE&scope=bot&permissions=0)
 10. Start TediCross: `npm start`
 11. Ask the bots for the remaining details. In the Telegram chat and the Discord channel, write `@<botname> chatinfo`. Put the info you get in the settings file
 12. Restart TediCross

Done! You now have a nice bridge between a Telegram chat and a Discord channel


Questions?
----------

If you need any help, ask [@Suppen](https://t.me/Suppen) on Telegram

