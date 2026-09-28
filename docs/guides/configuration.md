# Configuration

Use [`example.settings.yaml`](../../example.settings.yaml) as the full, commented template. Copy it to `settings.yaml`, keep the YAML indentation, and edit the values. TediCross fills in omitted global options with defaults, but each bridge needs its name, direction, chat ID, channel ID, and required relay settings.

Tokens can be written directly in the config or set to `env` to read `TELEGRAM_BOT_TOKEN` and `DISCORD_BOT_TOKEN`. Prefer environment variables or a secrets manager on shared hosts. Do not commit `settings.yaml`.

## Top-level options

| Option | Default | Meaning |
| --- | --- | --- |
| `messageTimeoutAmount` | `24` | How long temporary cross-platform message mappings are retained. |
| `messageTimeoutUnit` | `hours` | Moment.js duration unit: years, months, weeks, days, hours, minutes, seconds, milliseconds, or their supported short aliases (`y`, `M`, `w`, `d`, `h`, `m`, `s`, `ms`). |
| `persistentMessageMap` | `false` | Store message mappings in SQLite under the configured data directory so they survive restarts. |
| `debug` | `false` | Enable additional diagnostic logging. |
| `bridges` | `[]` | List of configured bridges. |

When persistence is enabled, TediCross needs a writable data directory. Mappings support cross-platform replies, edits, and deletion behavior; they are not an archive of chat content.

## Global Telegram options

Under `telegram`:

| Option | Default | Meaning |
| --- | --- | --- |
| `token` | `env` | Telegram bot token or `env`. |
| `useFirstNameInsteadOfUsername` | `false` | Prefer first/last name when displaying Telegram senders in Discord. |
| `colonAfterSenderName` | `false` | Add a colon after sender names in messages sent to Telegram. |
| `skipOldMessages` | `true` | Skip messages accumulated while the bot was offline. |
| `sendEmojiWithStickers` | `true` | Include a sticker's associated emoji when available. |
| `useCustomEmojiFilter` | `false` | Remove Discord custom emoji that were not replaced through `emojiMap` in Discord-to-Telegram text. |
| `emojiMap` | `{}` | Map Discord custom emoji names to replacement strings for Telegram. |
| `replaceAtWithHash` | `false` | Replace `@` with `#` in Discord-to-Telegram text. |
| `replaceExcessiveSpaces` | `false` | Collapse repeated spaces in Discord-to-Telegram text. |
| `removeNewlineSpaces` | `false` | Remove indentation spaces after line breaks in Discord-to-Telegram text. |
| `suppressFileTooBigMessages` | `false` | Suppress Telegram notices when a file cannot be forwarded because of Discord's upload limit. |
| `suppressThisIsPrivateBotMessage` | `false` | Suppress notices sent when a chat/channel is not configured as a bridge. |
| `enableBridgeManagement` | `false` | Enable the optional Telegram `/connect` and `/remove` commands. See [bridge management](bridges-and-topics.md#optional-telegram-bridge-management). |

`emojiMap` maps names without surrounding Discord emoji syntax, for example:

```yaml
telegram:
  emojiMap:
    photon: "✨"
```

## Global Discord options

Under `discord`:

| Option | Default | Meaning |
| --- | --- | --- |
| `token` | `env` | Discord bot token or `env`. |
| `useNickname` | `false` | Use the server nickname when displaying Discord senders in Telegram. |
| `skipOldMessages` | `true` | Skip messages accumulated while the bot was offline. |
| `replyLength` | `100` | Maximum source-message characters included in reply context. |
| `maxReplyLines` | `2` | Maximum source-message lines included in reply context. |
| `suppressThisIsPrivateBotMessage` | `false` | Suppress notices sent when a chat/channel is not configured as a bridge. |
| `enableCustomStatus` | `false` | Enable a custom Discord activity/status. |
| `customStatusMessage` | `TediCross` | Text used when the custom status is enabled. |
| `useEmbeds` | `auto` | Legacy field retained in the example for compatibility. Per-bridge `discord.useEmbeds` controls message relay behavior (`always`, `never`, or `auto`). |

## Bridge options

Each entry in `bridges` connects one Telegram chat to one Discord text channel:

```yaml
bridges:
  - name: Community
    direction: both # both, d2t, or t2d
    telegram:
      chatId: -1001234567890
      # bridge options...
    discord:
      channelId: '123456789012345678'
      # bridge options...
```

Bridge names must be unique. Directions are `both`, `d2t` (Discord to Telegram), and `t2d` (Telegram to Discord). Keep Discord snowflake IDs quoted strings. Telegram user ID filters are also strings.

### Telegram side of a bridge

Under `bridges[].telegram`:

| Option | Default | Meaning |
| --- | --- | --- |
| `chatId` | required | Telegram group, supergroup, or channel ID. |
| `sendUsernames` | required | Include sender names in messages sent to Discord. |
| `relayJoinMessages` / `relayLeaveMessages` | required | Relay member join/leave events where supported. |
| `crossDeleteOnDiscord` | `true` for migrated configs | Delete the Discord copy when the Telegram message is edited to a single dot. Telegram does not provide bots with general message-deletion updates. |
| `allowedUserIds` | `[]` | If nonempty, only relay messages from these Telegram users. |
| `blockedUserIds` | `[]` | Never relay messages from these Telegram users; blocked IDs take precedence over the allow list. |
| `ignoreBots` | `true` | Skip Telegram bot-authored messages. |
| `groupMessages` | `false` | Group consecutive messages from the same sender when supported. |
| `messageStyle` | `text` | Use `text` or Discord `componentsV2` layout for Telegram-to-Discord messages. |
| `media` | all enabled | Configure Telegram-to-Discord photo, video/GIF, audio/voice, file, and sticker forwarding. |

For each media type, `enabled: false` replaces that media with its `replacementText`. A disabled photo album produces one replacement notice. Set `media.enabled: false` to disable all media types for that bridge. The template shows all individual fields and defaults. This setting controls Telegram-to-Discord forwarding.

### Discord side of a bridge

Under `bridges[].discord`:

| Option | Default | Meaning |
| --- | --- | --- |
| `channelId` | required | Discord text channel ID. |
| `sendUsernames` | required | Include sender names in messages sent to Telegram. |
| `relayJoinMessages` / `relayLeaveMessages` | required | Relay Discord member join/leave events where available to the bot. |
| `crossDeleteOnTelegram` | required | `true` deletes the Telegram copy, `false` leaves it, and `mark` marks it when a Discord message is deleted. |
| `allowedUserIds` | `[]` | If nonempty, only relay messages from these Discord users. |
| `blockedUserIds` | `[]` | Never relay messages from these Discord users; blocked IDs take precedence over the allow list. |
| `ignoreBots` | `true` | Skip messages authored by Discord bots. |
| `ignoreWebhooks` | `true` | Skip messages authored by Discord webhooks. |
| `groupMessages` | `false` | Group consecutive messages from the same sender when supported. |
| `disableWebPreviewOnTelegram` | unset | Disable Telegram link previews for Discord-to-Telegram messages. |
| `useEmbeds` | required | Embed behavior: `always`, `never`, or `auto`. |

## Forum topics and threads

For per-topic routing, add `topicBridges` to a bridge. Each mapping pairs a Telegram forum topic ID with a Discord thread or text channel ID. See [bridges and topics](bridges-and-topics.md) for setup steps and automatic topic creation.

```yaml
    topicBridges:
      - name: Support
        telegram: 80
        discord: '1554022361244762174'
    topicBridgesAutoCreate: false
```

Old configurations using `threadMap` are migrated to `topicBridges` at startup. New configurations should use `topicBridges`.
