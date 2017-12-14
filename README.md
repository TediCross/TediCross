TediCross
=========
TediCross is a bot which bridges a chat in [Telegram](https://telegram.org) with a channel in [Discord](https://discordapp.com/).

There is no public TediCross bot. You need to host it yourself. One bot per bridge. To host a bot, you need [nodejs](https://nodejs.org). The bot requires NodeJS 6 or higher


TediCross News Channel
----------------------

We now have a Telegram channel where we post news about the bot! Join us at https://t.me/TediCross


Features & known bugs
---------------------

The bot is able to relay text messages and media files between Discord and Telegram. @-mentions, URLs, code (both inline and block-style) works well

For a list of known bugs, or to submit a bug or feature request, see this repo's "Issues" tab


Step by step installation:
--------------------------
Setting up the bot requires basic knowledge of the command line, which is bash or similar on Linux/Mac, and cmd.exe in Windows

 1. Install [nodejs](https://nodejs.org)
 2. Clone this git repo, or download it as a zip or whatever
 3. Enter the repo
 4. `npm install`
 5. Make a copy of the file `example.settings.json` and name it `settings.json`
 6. Aquire a bot token for Telegram ([How to create a Telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)) and put it in the settings file
   - The Telegram bot must be able to access all messages. Talk to [@BotFather](https://t.me/BotFather) to disable privacy mode for the bot
 7. Aquire a bot token for Discord ([How to create a Discord bot](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token)) and put it in the settings file
 8. Add the Telegram bot to the Telegram chat
   - If the Telegram chat is a supergroup, the bot also needs to be admin of the group, or it won't get the messages. The creator of the supergroup is able to give it admin rights
 9. Add the Discord bot to the Discord server (https://discordapp.com/oauth2/authorize?client_id=YOUR_CLIENT_ID_HERE&scope=bot&permissions=248832). This requires that you have admin rights on the server
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
> A: If you cloned the repo, it's as simple as using the command `git pull`. If you downloaded it as a zip, or somehow else, download it again and copy your settings file. It may or may not be necessary to run `npm install` again, but running it certainly won't hurt

Settings
--------

As mentioned in the step by step installation guide, there is a settings file. Here is a description of what the settings do.

* `telegram.auth.token`: The Telegram bot's token. It is needed for the bot to authenticate to the Telegram servers and be able to send and receive messages
* `telegram.useFirstNameInsteadOfUsername`: **EXPERIMENTAL** If set to `false`, the messages sent to Discord will be tagged with the sender's username. If set to `true`, the messages sent to Discord will be tagged with the sender's first name (or nickname). Note that Discord users can't @-mention Telegram users by their first name. Defaults to `false`
* `telegram.colonAfterSenderName`: Whether or not to put a colon after the name of the sender in messages from Discord to Telegram. If true, the name is displayed `Name:`. If false, it is displayed `Name`. Defaults to false
* `telegram.skipOldMessages`: Whether or not to skip through all previous messages cached from the telegram-side and start processing new messages ONLY. Defaults to true
* `discord.auth`: The Discord bot's token. It is needed for the bot to authenticate to the Discord servers and be able to send and receive messages
* `debug`: If set to `true`, activates debugging output from the bot. Defaults to `false`
* `bridgeMap`: An array containing all your chats and channels. For each object in this array, you should have the following properties:
	* `name`: A internal name of the chat, so you can distinguish the chats when looking at log errors etc.
	* `telegram`: ID of the chat the Telegram bot is in. The bot must know which chat it should work with, so it knows where to send messages from Discord, and where to get messages from. The easiest way to get this ID is to ask the bot. See the step by step guide
	* `discord.guild`: ID of the server the Discord bot is in. If a message to the bot originates from within this server, but not the correct channel, it is ignored. If it originates from another server, they are told to get their own TediCross instance. The easiest way to get this ID is to ask the bot. See the step by step guide
	* `discord.channel`: ID of the channel the Discord bot should work in. This is the channel all messages will be relayed to/from. It is usually the same as the `discord.guild`, but can be different. The easiest way to get this ID is to ask the bot. See the step by step guide

The available settings and their default values will occasionally change. When they do, you will be notified when the bot starts


Questions?
----------

If you need any help, ask [@Suppen](https://t.me/Suppen) on Telegram
