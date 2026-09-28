# Build and contribute

TediCross is written in TypeScript. Use Node.js 22.13 or newer and npm.

## Local development

```bash
git clone https://github.com/TediCross/TediCross.git
cd TediCross
npm ci
npm run build
```

The compiled JavaScript is written to `dist/`. Configure `settings.yaml` before running the bot with `npm start`. The project also provides:

| Command | Purpose |
| --- | --- |
| `npm run lint` | Lint TypeScript source files. |
| `npm run build` | Compile TypeScript into `dist/`. |
| `npm run start:dev` | Run the TypeScript entry point with nodemon during development. |
| `npm run clean` | Remove the generated `dist/` directory. |

Do not commit local settings or bot tokens. For config fields and bridge examples, see the [configuration guide](../guides/configuration.md).

## Pull requests

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) before opening a pull request. Target the active development branch shown by the repository, describe user-visible changes, and include the related issue number when applicable. Changes should pass the repository's lint and build checks.

## Docker build

To build the local image with the repository's Compose configuration, create `settings.yaml` first and run:

```bash
docker compose build
```

To start the bot too, use `docker compose up --build -d`. See the [Docker guide](../guides/docker.md) for mounts and runtime configuration.
