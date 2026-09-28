# Bridges, forum topics, and Discord threads

A bridge connects one Telegram chat to one Discord text channel. Add one or more entries to `bridges` in `settings.yaml`; each bridge needs a unique name, direction, Telegram chat ID, and Discord channel ID. See the [configuration reference](configuration.md) and [`example.settings.yaml`](../../example.settings.yaml).

```yaml
bridges:
  - name: Community
    direction: both
    telegram:
      chatId: -1001234567890
      sendUsernames: true
      relayJoinMessages: true
      relayLeaveMessages: true
      crossDeleteOnDiscord: true
    discord:
      channelId: '123456789012345678'
      sendUsernames: true
      relayJoinMessages: true
      relayLeaveMessages: true
      crossDeleteOnTelegram: true
      useEmbeds: auto
```

`both` relays in both directions. `d2t` means Discord to Telegram; `t2d` means Telegram to Discord. Discord IDs must be quoted in YAML to preserve their exact value. Telegram group and channel IDs are usually negative.

## Find IDs

- In Telegram, run `/chatinfo` in the target chat. Run `/threadinfo` inside the target forum topic to get both the chat and topic IDs.
- In Discord, run `/chatinfo` in the target channel. Run `/threadinfo` inside the target thread.

The bot must be able to view the selected Discord channel/thread and read messages. Telegram bots need group access and, for ordinary group messages, privacy mode disabled.

## Map Telegram topics to Discord threads

Add mappings under the bridge's `topicBridges`. Use the Telegram topic ID as a number and the Discord thread ID as a quoted string:

```yaml
    topicBridges:
      - name: Support
        telegram: 80
        discord: '1554022361244762174'
```

Messages in that Telegram topic route to that Discord thread, and messages in the thread route back to the mapped topic. A mapping may point to a Discord text channel instead of a thread.

Set `topicBridgesAutoCreate: true` to create a Telegram forum topic automatically when an unmapped Discord thread is used. TediCross records that mapping in `settings.yaml`, so the config must be writable for this option to persist it.

Older configurations may have `threadMap`; TediCross migrates it to `topicBridges`. Keep a backup before updating old configuration files.

## Optional Telegram bridge management

Bridge management is disabled by default. Enable it with global `telegram.enableBridgeManagement: true`. These commands are run from Telegram and require the user to be an administrator of the group:

- `/connect <bridge name> <Discord channel ID>` creates a bridge based on an existing bridge's settings. At least one configured bridge must exist as a template.
- `/connect <Discord channel ID>` inside a forum topic maps that topic in its group's existing bridge.
- `/remove <bridge name>` removes a bridge for the current Telegram group.
- `/remove` inside a mapped topic removes that topic mapping.

Discord IDs are still required for these commands. Changes are saved into the settings file, so TediCross needs write access to it when bridge management is enabled.
