# Troubleshooting

## No messages are relayed

- Check that the Telegram chat ID and Discord channel ID match the configured bridge. Telegram group/channel IDs are usually negative; Discord IDs must be quoted strings in YAML.
- Confirm the bridge direction allows the direction you are testing.
- Confirm the Telegram bot is in the chat and can read/send messages. For ordinary group messages, turn off bot privacy mode with BotFather.
- Confirm the Discord bot can view the channel, read message history, send messages, and attach files. Check the Discord application's **Message Content Intent**.
- For topics and threads, check both IDs and the `topicBridges` mapping. Use `/threadinfo` in the topic/thread to read IDs.
- Check logs for configuration, permission, or API errors.

## Telegram or Discord reports that the chat is not configured

That notice usually means the message's chat/channel ID does not match a bridge, or its direction is disabled. If the bridge is correct and you intentionally want to suppress these notices, use `suppressThisIsPrivateBotMessage` in the corresponding global Telegram or Discord settings.

## Telegram messages from other bots are missing

Telegram's Bot API does not deliver messages from other bots to bots, so TediCross cannot relay them. TediCross also skips Telegram bot messages by default with bridge option `telegram.ignoreBots`.

## Discord bot or webhook messages are missing

Discord bot messages and webhook messages are skipped by default. Set `discord.ignoreBots` or `discord.ignoreWebhooks` to `false` on the bridge if those messages should be relayed. Review loop risks before relaying bots in both directions.

## Message deletion behavior

Telegram bots cannot receive general message-deletion updates. Telegram-to-Discord cross-delete is limited to the supported dot edit behavior. Discord deletion can delete or mark the Telegram copy using `discord.crossDeleteOnTelegram`.

## Upload omitted or too large

Discord's upload limit depends on the server's boost level. TediCross estimates the limit from the target guild and lets Discord's API response be the final check. It can omit files that exceed the limit; the notice names the file and limit when available. The original Telegram message remains in Telegram. Reduce/compress the file or configure the Telegram-side `media` options to replace media types with text notices.

## Telegram says the bot was terminated by another long poll or webhook

Only one running process should use a Telegram bot token. Check for another TediCross instance or a webhook configured for that bot. If the token may be exposed, replace it with BotFather and update the service configuration.

## Settings file is read-only or cannot be updated

TediCross may migrate settings automatically. If the file cannot be written, it logs a warning and may write the updated config to a temporary file. Copy the migration into your config yourself. Optional bridge-management commands and automatic forum-topic mapping also need the config file to be writable.

## Discord IDs look adjacent or map to the wrong channel

Quote every Discord snowflake ID in YAML, for example `'123456789012345678'`. Unquoted IDs can be interpreted as numbers and lose precision.

For more help, use the [Telegram support group](https://t.me/TediCrossSupport), [Discord server](https://discord.gg/MfzGMzy), or [GitHub issues](https://github.com/TediCross/TediCross/issues).
