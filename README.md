TediCross
=========
TediCross is a bot which bridges a chat in [Telegram](https://telegram.org) with a channel in [Discord](https://discord.com/).

There is no public TediCross bot. You need to host it yourself. To host a bot, you need [nodejs](https://nodejs.org). The bot requires NodeJS 16 or higher.

If you are cloning the repository and looking for the stable release, switch to the `stable` branch.


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

 1. Install [nodejs](https://nodejs.org). TediCross requires at least node version 16
 2. Download the latest [release](https://github.com/TediCross/TediCross/releases/latest)
 3. Open a terminal and enter the repo with the [`cd`](https://en.wikipedia.org/wiki/Cd_(command)) command. Something like `cd Downloads/TediCross-master`. Your exact command may differ
 4. Run the command `npm install --omit=dev`
 5. Make a copy of the file `example.settings.yaml` and name it `settings.yaml`
 6. Acquire a bot token for Telegram ([How to create a Telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)) and put it in the settings file
   - The Telegram bot must be able to access all messages. Talk to [@BotFather](https://t.me/BotFather) to disable privacy mode for the bot
   - Do NOT use another bot you already have running. That will cause all sorts of weird problems. Make a new one
 7. Acquire a bot token for Discord ([How to create a Discord bot](https://discordjs.guide/preparations/setting-up-a-bot-application.html)), enable the `Message Content Intent` under `Bot` > `Privileged Gateway Intents` and put it in the settings file under `discord.token`. **NOTE** that the token is NOT the "Client Secret". The token is under the section "Bot" further down the page
   - Do NOT use another bot you already have running. That will cause all sorts of weird problems. Make a new one
 8. Add the Telegram bot to the Telegram chat
   - If the Telegram chat is a supergroup, the bot also needs to be admin of the group, or it won't get the messages. The creator of the supergroup is able to give it admin rights
 9. Add the Discord bot to the Discord server (https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID_HERE&scope=bot&permissions=248832). This requires that you have admin rights on the server
 10. Start TediCross: `npm start`
 11. Ask the bots for the remaining details. In the Telegram chat and the Discord channel, write `/chatinfo`. Put the info you get in the settings file.
   - If you want to bridge a Telegram group or channel, remember that the ID is negative. Include the `-` when entering it into the settings file
   - It is important that the Discord  channel ID is wrapped with single quotes when entered into the settings file. `'244791815503347712'`, not `244791815503347712`
 12. Restart TediCross. You stop it by pressing CTRL + C in the terminal it is running in
 13. To turn on threads support (EXPERIMENTAL) just add `threadMap` section under particular `Bridge`. Write `/threadinfo` in telegram and discord threads to get corresponding IDs.

Done! You now have a nice bridge between a Telegram chat and a Discord channel

Running in Docker
--------

Please refer to [Docker Guide](./guides/docker/Docker.md) for the details.


Settings
--------

As mentioned in the step-by-step installation guide, there is a settings file. Here is a description of what the settings do.

* `telegram`: Object authorizing and defining the Telegram bot's behavior
	* `token`: The Telegram bot's token. It is needed for the bot to authenticate to the Telegram servers and be able to send and receive messages. If set to `"env"`, TediCross will read the token from the environment variable `TELEGRAM_BOT_TOKEN`
	* `useFirstNameInsteadOfUsername`: If set to `true`, the messages sent to Discord will be tagged with the sender's first name + last name. If set to `false` - sender's username will be preferred, but if username is not set - first name + last name. Note that Discord users can't @-mention Telegram users by their first name. Defaults to `false`
	* `colonAfterSenderName`: Whether to put a colon after the name of the sender in messages from Discord to Telegram. If true, the name is displayed `Name:`. If false, it is displayed `Name`. Defaults to false
	* `skipOldMessages`: Whether to skip through all previous messages cached from the telegram-side and start processing new messages ONLY. Defaults to true. Note that there is no guarantee the old messages will arrive at Discord in order
	* `sendEmojiWithStickers`: Whether to send the corresponding emoji when relaying stickers to Discord
	* `filterCustomEmojis`: Determines what to do with custom emojis from Discord message before it reaches telegram. Has three states:
		01. `default` - custom emojis will be transferred without any processing (ex: <:emojisnhead:1102667149627113602> My Text);
		02. `remove` - custom emojis will be removed from the output (ex: My Text);
		03. `replace` - custom emojis will be replaced with a definable string. Defined in `replaceCustomEmojisWith` (ex: 🔹 My Text).
		Defaults to `default`
	* `replaceCustomEmojisWith`: Determines a string that will be used as a replacement for custom emojis. Anything that can be passed as a string is supported, including emojis. Defaults to `🔹`
	* `replaceAtSign`: Whether to replace `@` sign to something else from Discord message before it reaches. When set to `true` will replace `@` with a string you put into `settings.replaceAtSignWith`. If set to `false` - will do nothing. Defaults to `false`
	* `replaceAtSignWith`: Determines the string that will be used as a replacement for `@` sign. Anything that can be passed as a string is supported, including emojis. Defaults to `#`
	* `removeExcessiveSpacings`: **USE WITH CAUTION** Whether to remove excessive (2 or more) `whitespaces` from Discord message. Can help to neat your message up if it wasn't particulary untidy in the source. When set to `true` will remove excessive `whitespaces` and replace them with a single `whitespace` instead. If set to `false` - will do nothing. Defaults to `false`
	* `suppressFileTooBigMessages`: Suppress warning messages on errors with sending too big files (due to API limitations) from telegram to discord. Defaults to `false`.
	* `suppressThisIsPrivateBotMessage`: If set to `true` - suppress warning messages (`This is an instance of a TediCross bot...`) in telegram chats outside configured bridges. Defaults to `false`
* `discord`: Object authorizing and defining the Discord bot's behavior
	* `token`: The Discord bot's token. It is needed for the bot to authenticate to the Discord servers and be able to send and receive messages. If set to `"env"`, TediCross will read the token from the environment variable `DISCORD_BOT_TOKEN`
	* `skipOldMessages`: Whether to skip through all previous messages sent since the bot was last turned off and start processing new messages ONLY. Defaults to true. Note that there is no guarantee the old messages will arrive at Telegram in order. **NOTE:** [Telegram has a limit](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this) on how quickly a bot can send messages. If there is a big backlog, this will cause problems
	* `useNickname`: Uses the sending user's nickname instead of username when relaying messages to Telegram
	* `replyLength`: How many characters of the original message to display on replies
	* `maxReplyLines`: How many lines of the original message to display on replies
	* `suppressThisIsPrivateBotMessage`: If set to `true` - suppress warning messages (`This is an instance of a TediCross bot...`) in discord channels outside configured bridges. Defaults to `false`
	* `enableCustomStatus`: If set to `true` - enables the custom status. Defaults to `false`
	* `customStatusMessage`: The message to set as custom status. Defaults to "TediCross"
* `debug`: If set to `true`, activates debugging output from the bot. Defaults to `false`
* `messageTimeoutAmount`: Amount for your unit of time to expire messages in MessageMap. Defaults to `24`
* `messageTimeoutUnit`: Format of time as a string (ie: 'hours', 'days', 'weeks', etc...). Defaults to `'hours'`
* `persistentMessageMap`: Allow MessageMap to persist between reboots by saving it to a file. Defaults to `false`
* `bridges`: An array containing all your chats and channels. For each object in this array, you should have the following properties:
	* `name`: A internal name of the chat. Appears in the log
	* `direction`: Direction of the bridge. "both" for bidirectional, "d2t" for discord-to-telegram, "t2d" for telegram-to-discord
	* `telegram.chatId`: ID of the chat that is the Telegram end of this bridge. See step 11 on how to acquire it
	* `telegram.relayJoinMessages`: Whether to relay messages to Discord about people joining the Telegram chat
	* `telegram.relayLeaveMessages`: Whether to relay messages to Discord about people leaving the Telegram chat
	* `telegram.sendUsernames`: Whether to send the sender's name with the messages to Discord
	<!--* `telegram.relayCommands`: If set to `false`, messages starting with a `/` are not relayed to Discord-->
	* `telegram.crossDeleteOnDiscord`: Whether to also delete the corresponding message on Discord when one is deleted on Telegram. **NOTE**: See FAQ about deleting messages.
	* `discord.channelId`: ID of the channel the Discord end of the bridge is in. See step 11 on how to acquire it
	* `discord.relayJoinMessages`: Whether to relay messages to Telegram about people joining the Discord chat
	* `discord.relayLeaveMessages`: Whether to relay messages to Telegram about people leaving the Discord chat
	* `discord.sendUsernames`: Whether to send the sender's name with the messages to Telegram
	* `discord.crossDeleteOnTelegram`: Whether to also delete the corresponding message on Telegram when one is deleted in Discord
	* `discord.disableWebPreviewOnTelegram`: Whether to disable links preview when relaying to Telegram
	* `discord.useEmbeds`: Whether to use embeds for current bridge. Can be `always`, `never`, `auto`. Defaults to `false`
	* `threadMap`: An array containing all threads mapping for each bridge
		* `telegram`: Telegram thread ID. See step 13 on how to acquire it
		* `discord`: Discord thread ID. See step 13 on how to acquire it

The available settings will occasionally change. The bot takes care of this automatically

FAQ
---

### What kind of machine do I need to run this?

Anything capable of running [NodeJS](https://nodejs.org) should be able to run TediCross. People have had success running it on ordinary laptops, raspberry pis, Amazon Web Services, Google Cloud Platform, and other machines. It runs on both Linux and Windows, and probably also macOS. It does NOT, however, run on [Heroku](https://heroku.com)

The machine must be on for TediCross to work

### Just how much knowledge of the command line do I need to get the bot working?

Not much at all. Almost all the commands are written in the installation guide exactly as they should be entered. The only thing you need to know in addition is the [`cd`](https://en.wikipedia.org/wiki/Cd_(command)) command, in order to navigate to wherever you unpacked TediCross

### The bot gives an error with the message `node: not found` when I try to run it

This likely means you are using Ubuntu or another Debian based Linux distro. You get node version 4 when you do `apt-get install nodejs`, and it is called `nodejs` instead of `node`.

TediCross requires node 16 or higher to run. To get node 16 on a Debian based system (including Ubuntu), run the following two commands:

```bash
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Then try to run the bot again

### The bot just responds with a generic message telling me to get my own TediCross instance

This happens when you have not entered correct chat IDs in the settings file. See step 11 in the step by step installation guide for instructions on how to get these.

A small gotcha here is that Telegram group chats always have a negative chat ID. Remember to include the "-" in the settings file!

### The Telegram bot doesn't relay messages sent by other bots

The Telegram team unfortunately decided that bots cannot interact with each other, fearing they would get stuck in infinite loops. This means it is impossible, under any circumstances, for TediCross to relay messages from other Telegram bots to Discord. Discord does not have this limitation, and the Discord side of the bot will happily relay messages from other Discord bots to Telegram

See https://core.telegram.org/bots/faq#why-doesn-39t-my-bot-see-messages-from-other-bots

### Deleting a message in Telegram does not delete it in Discord

Telegram bots are unfortunately completely unable to detect when a message is deleted. There is no way to implement T2D cross-deletion until Telegram implements this.
**NOTE**: A partial solution to this has been implemented. When a message on Telegram is edited to become just a single dot (`.`), TediCross will delete it both on Telegram and on Discord.

Deleting messages D2T works as expected


### When running `npm install`, it complains about missing dependencies?

The [Discord library](https://discord.js.org/#/) TediCross is using has support for audio channels and voice chat. For this, it needs some additional libraries, like [node-opus](https://www.npmjs.com/package/node-opus), [libsodium](https://www.npmjs.com/package/libsodium) and others. TediCross does not do audio, so these warnings can safely be ignored

### How do I create more bridges?

TediCross supports a theoretically infinite number of bridges, limited only by your hardware. Even a simple Raspberry Pi is powerful enough to run multiple bridges, so don't worry about making more

To make more bridges, just copy the one you have, paste it right below and make necessary changes:

```yml
...
bridges:
  - name: Default bridge
    direction: both
    telegram:
      ...
    discord:
      ...
  - name: Another bridge
    direction: both
    telegram:
      ...
    discord:
      ...
...
```

The names of the bridges are practically only log identifiers. They can be whatever string you want them to be. Note, however, that the setting `discord.skipOldMessages` uses the names to know which messages was last sent from which channel, so they should be unique.

Note that the settings file is indentation sensitive. If you do for example
```yml
  - name: Bridge1
      direction: both
```
it won't work. The "d" in "direction" must be directly below the "n" in "name". See `example.settings.yaml` for proper indentation


### TediCross spams errors in the console saying "terminated by other long poll or web hook"

This happens when two applications use the same Telegram bot token, or someone has set a webhook on the Telegram bot token. You may simply have accidentally launched two instances of TediCross, or someone else has somehow gotten hold of your token

If you haven't accidentally launched two instances of TediCross, assume the token is compromised. First, talk to [@BotFather](https://t.me/BotFather) to generate a new token for the bot. Then go to https://api.telegram.org/botTOKEN/deleteWebhook (with `TOKEN` replaced with your actual token) to get rid of any webhook set for the bot. Then update the settings file, and restart the bot


### How do I make the bot run automatically when my computer/server starts?

Take a look in [guides/autostart/](guides/autostart/) of this repo


### How do I update TediCross?

Most updates are announced on the [TediCross News channel](https://t.me/TediCross). Only very minor ones are not

If you cloned the git repo, just do a `git pull`, followed by `npm install --omit=dev`.

If you downloaded TediCross as a zip, do step 2, 3 and 4 in the installation guide again. Then move `settings.yaml` and the whole `data/` directory from the old version to the new one and start it.

### Why don't you use webhooks to send the messages to Discord? They are much better

This has been tried, and it did indeed make the messages much prettier. The bot can impersonate multiple people this way. Unfortunately, messages sent through a webhook does not belong to the bot, meaning the bot cannot edit them. Cross-editing from Telegram to Discord is then lost. In addition, it requires the bot owner to have two-factor authentication activated.

### Do you know of any way to relay messages from Discord to Telegram (or the other way) without bots?

No

### Why is TediCross sending a link to this repository to my chat (Advertizing? Spam?)?

TediCross will send a link to this documentation to every chat it is in which is not configured to bridge correctly. Please use this documentation to configure your bot for bridging and the behavior will stop.

Other questions?
----------------

If you need any help, [join our group](https://t.me/TediCrossSupport) on Telegram or [our server](https://discord.gg/MfzGMzy) on Discord

Want to donate?
---------------

Cryptocoins of the following types are accepted:

* BTC: 1Gzr9ZyvTiFCPKfy2BshuZgUeFLebAfbFU
* ETH: 0x9449D54C85C8FdB079e74379d93A9C9fe611981A

These donations go to the original creator, not the current maintainer.
