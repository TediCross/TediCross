TediCross with Docker
=====================

**This document assumes you know how to use [Docker](https://en.wikipedia.org/wiki/Docker_(software)). If you are completely clueless, please disregard Docker and follow the ordinary [install instructions](README.md#step-by-step-installation)**

TediCross is available as a Docker image, through [DockerHub](https://cloud.docker.com/u/tedicross/repository/docker/tedicross/tedicross)

It requires the `data/` directory to be mounted as a volume.

Unlike the non-docker version, the `settings.yaml` file must be in the `data/` directory instead of in the root of the project.

Using the official Docker image
-------------------------------

The official docker image is used  like this:

```
docker run \
  -v /path/to/data/:/opt/TediCross/data \
  -e TELEGRAM_BOT_TOKEN="Your Telegram token" \
  -e DISCORD_BOT_TOKEN="Your Discord token" \
  tedicross/tedicross
```

Of course, you can add `-d` or `--rm` or a name or whatever else you want to that command

If you have the tokens in the settings file instead of reading them from the environment, you can of course drop the `-e` lines
