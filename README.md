TediCross
=========
TediCross is a bot which bridges a chat in [Telegram](https://telegram.org) with a channel in [Discord](https://discordapp.com/).

There is no public TediCross bot. You need to host it yourself. One bot per bridge. To host a bot, you need [nodejs](https://nodejs.org). The bot requires NodeJS 6 or higher


Features & known bugs
---------------------

Currently, the bot is able to relay ordinary text messages from Telegram to Discord and vice versa. Formatting of the messages, like @-mentions, inline- and block-style code, URLs etc. work.

The bot sometimes crashes for reasons unknown. Just restart the bot, and it works again.

For a list of known bugs, or to submit a bug or feature request, see this repo's "Issues" tab


Step by step installation:
-------------
Setting up the bot requires basic knowledge of the command line, which is bash or similar on Linux/Mac, and cmd.exe in Windows

 1. Install [nodejs](https://nodejs.org)
 2. Clone this git repo, or download it as a zip or whatever
 3. Enter the repo
 4. `npm install`
 5. Copy the file `example.settings.json` to `settings.json`
 6. Aquire a bot token for Telegram ([How to create a Telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)) and put it in the settings file
   - The Telegram bot must be able to access all messages. Talk to [@BotFather](https://t.me/Suppen) to disable privacy mode for the bot
 7. Aquire a bot token for Discord ([How to create a Discord bot](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token)) and put it in the settings file
 8. Add the Telegram bot to the Telegram chat
   - If the Telegram chat is a supergroup, the bot also needs to be admin of the group, or it won't get the messages. The creator of the supergroup is able to give it admin rights
 9. Add the Discord bot to the Discord server (https://discordapp.com/oauth2/authorize?&client_id=YOUR_CLIENT_ID_HERE&scope=bot&permissions=0). This requires that you have admin rights on the server
 10. Start TediCross: `npm start`
 11. Ask the bots for the remaining details. In the Telegram chat and the Discord channel, write `@<botname> chatinfo`. Put the info you get in the settings file
 12. Restart TediCross

Done! You now have a nice bridge between a Telegram chat and a Discord channel

FAQ
---

Thanks to Etheral for helping make this

> Q: I'm new to this! How do I enter the repo and start issuing commands?
> A: Open up your command prompt - bash or similar in Linux/Mac or cmd.exe in Windows - and navigate to the directory in which you extracted TediCross. You can use the `cd [directory]` command to navigate there one step at a time, ex. `cd Downloads`. 
> 
> Q: When I enter "npm start", my cmd window starts producing endless errors!
> A: That might mean you're missing the bot token for Telegram or Discord - both of those should be inserted into their places in the settings.json file.
> 
> Q: The bot responds with a generic help message when I ask it for info!
> A: The command to write is "@botname chatinfo", not "@botname /chatinfo"
> 
> Q: My bot is responding to messages sent in one of the chats, but it's responding with a generic help message!
> A: Doublecheck the Telegram and Discord chat IDs you put into settings.json. Group chats in Telegram always have a negative ID, so they start with a "-"
> 
> Q: I see in the Git repo there's an update to the bot. How do I update it?
> A: If you cloned the repo, it's as simple as using the command `git pull`. If you downloaded it as a zip, or somehow else, download it again and copy your settings file. It may or may not be necessary to run `npm install` again


Questions?
----------

If you need any help, ask [@Suppen](https://t.me/Suppen) on Telegram


