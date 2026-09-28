# Installation

TediCross requires **Node.js 22.13 or newer**. Create separate Telegram and Discord bot applications for each TediCross instance; a bot token should not be used by two running instances.

## 1. Get the project

Download a [release archive](https://github.com/TediCross/TediCross/releases/latest), or clone the repository if you want to run from source. In the project directory, install dependencies and compile:

```bash
npm ci
npm run build
```

For a runtime-only install, use `npm ci --omit=dev` with a release that already contains the compiled `dist/` directory.

## 2. Create the bot accounts

Create a Telegram bot with [BotFather](https://core.telegram.org/bots#3-how-do-i-create-a-bot). For group relaying, disable bot privacy mode so it can receive ordinary group messages. Add it to each chat you plan to bridge. In Telegram supergroups, give it the permissions needed to read and send messages and media.

Create a Discord application and bot following the [Discord developer guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html). Enable the **Message Content Intent** under **Bot → Privileged Gateway Intents**. Invite the bot to the server and grant access to the bridged channels, including permission to view channels, read history, send messages, and attach files. If using forum topics or threads, make sure it can access those as well.

Keep both tokens private. The bot tokens are not the Discord application's client secret.

## 3. Configure and start

Copy the example and edit it:

```bash
cp example.settings.yaml settings.yaml
```

Set `telegram.token` and `discord.token` to your tokens, or set them to `env` and provide the `TELEGRAM_BOT_TOKEN` and `DISCORD_BOT_TOKEN` environment variables. Add at least one bridge using the [configuration guide](configuration.md) and [bridge guide](bridges-and-topics.md).

Start the bot:

```bash
npm start
```

The default settings path is `settings.yaml` beside the project files; the default data directory is `data/`. You can override them with `--config` / `-c` and `--data-dir` / `-d`:

```bash
node dist/main.js --config /path/to/settings.yaml --data-dir /path/to/tedicross-data
```

TediCross writes settings migrations back to the config file when possible. If the config is mounted read-only, review any migration warning and update the file yourself.

## 4. Find chat and channel IDs

Use `/chatinfo` in Telegram and `/chatinfo` in Discord to get the IDs. Use `/threadinfo` inside a Telegram forum topic or Discord thread to get its topic/thread ID. See [bridges and topics](bridges-and-topics.md) for mapping them.

Telegram group and channel IDs are commonly negative. Discord IDs are snowflakes and must be quoted in YAML, for example `'123456789012345678'`, to avoid numeric precision loss.

## Keep TediCross running

For Docker, see [Docker deployment](docker.md). For a host service, see the [Linux](autostart-linux.md) or [Windows](autostart-windows.md) guide.
