# Run TediCross as a Linux service

Use `systemd` to start TediCross on boot and restart it after an unexpected exit. This example assumes the project is installed in `/opt/tedicross` and the service runs as a dedicated `tedicross` user.

Ensure the user can read the project and settings file and write to the data directory. Store bot tokens in a protected environment file rather than committing them to the repository.

Create `/etc/systemd/system/tedicross.service`:

```ini
[Unit]
Description=TediCross Telegram and Discord bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tedicross
Group=tedicross
WorkingDirectory=/opt/tedicross
EnvironmentFile=/etc/tedicross/tedicross.env
ExecStart=/usr/bin/node /opt/tedicross/dist/main.js --config /opt/tedicross/settings.yaml --data-dir /opt/tedicross/data
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Create the environment file with permissions that restrict access to the service administrator:

```ini
TELEGRAM_BOT_TOKEN=replace-with-your-telegram-token
DISCORD_BOT_TOKEN=replace-with-your-discord-token
```

Make sure the YAML tokens are set to `env`. Then load and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tedicross
sudo systemctl status tedicross
```

View logs with `sudo journalctl -u tedicross -f`. After changing the unit file, run `sudo systemctl daemon-reload`; after changing code or config, restart with `sudo systemctl restart tedicross`.
