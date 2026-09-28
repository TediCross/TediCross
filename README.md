# TediCross

TediCross is a self-hosted bot that bridges Telegram chats and Discord channels. It relays text, media, replies, edits, and supported deletion events between the services.

You need your own Telegram bot, Discord application, and a host running **Node.js 22.13 or newer**. There is no public TediCross bot.

## Get started

1. Follow the [installation guide](docs/guides/installation.md).
2. Create `settings.yaml` from [`example.settings.yaml`](example.settings.yaml) and configure your tokens and bridge IDs using the [configuration guide](docs/guides/configuration.md).
3. Start TediCross with `npm start`.

Already using Docker? See [Docker deployment](docs/guides/docker.md). Building or contributing? Start with the [development guide](docs/development/building.md).

## Documentation

- [All guides](docs/README.md)
- [Bridge and topic setup](docs/guides/bridges-and-topics.md)
- [Troubleshooting](docs/guides/troubleshooting.md)

## Community

- [TediCross news on Telegram](https://t.me/TediCross)
- [Support group on Telegram](https://t.me/TediCrossSupport)
- [Support server on Discord](https://discord.gg/MfzGMzy)
- [Report an issue or request a feature](https://github.com/TediCross/TediCross/issues)

## Donations

Cryptocurrency donations are accepted. Donations go to the original creator, not the current maintainer.

- BTC: `1Gzr9ZyvTiFCPKfy2BshuZgUeFLebAfbFU`
- ETH: `0x9449D54C85C8FdB079e74379d93A9C9fe611981A`

## License

TediCross is licensed under the [MIT License](LICENSE).
