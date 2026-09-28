# Docker deployment

The official image is published to [Docker Hub](https://hub.docker.com/r/tedicross/tedicross) and [GitHub Container Registry](https://github.com/orgs/TediCross/packages). Images include `linux/amd64` and `linux/arm64` builds. The container runs as the unprivileged `node` user.

The `latest` tag follows stable releases, `dev` follows pushes to the development branch, and version or commit tags identify specific builds. Pin a version or commit tag when you need repeatable deployments.

## Run the local Compose example

The repository's [`compose.yaml`](../../compose.yaml) builds the checked-out source, mounts `settings.yaml` read-only, and stores persistent data in a named volume. From the repository root:

```bash
cp example.settings.yaml settings.yaml
# Edit settings.yaml and configure both bot tokens and at least one bridge.
docker compose up --build -d
docker compose logs -f tedicross
```

Stop the service with `docker compose down`. The named data volume remains unless explicitly removed. Compose can load tokens from the environment when the settings use `token: env`; see the comments in `compose.yaml`.

## Use a published image

For example, run the latest stable image with a settings file and persistent data directory:

```bash
docker run -d \
  --name tedicross \
  --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN \
  -e DISCORD_BOT_TOKEN \
  -v "$PWD/settings.yaml:/run/tedicross/settings.yaml:ro" \
  -v "$PWD/data:/opt/TediCross/data" \
  ghcr.io/tedicross/tedicross:latest \
  --config /run/tedicross/settings.yaml \
  --data-dir /opt/TediCross/data
```

The image defaults to reading `data/settings.yaml`; the explicit command above allows the config to be mounted separately and read-only. Ensure the host data directory exists and is writable by the container's `node` user (UID 1000 in the current Node Alpine image). If `persistentMessageMap` is disabled and topic auto-creation is off, the app may not need to write data, but a writable data mount is recommended for future settings.

The container filesystem is read-only in the supplied Compose example, with a temporary writable `/tmp` and all Linux capabilities dropped. Keep the settings file private because it may contain bot tokens.

See [Docker's documentation](https://docs.docker.com/) for container and volume management.
