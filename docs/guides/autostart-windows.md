# Run TediCross automatically on Windows

Use Windows Task Scheduler to launch TediCross when your user logs in or when the computer starts.

1. Install Node.js 22.13 or newer and install/build TediCross as described in the [installation guide](installation.md).
2. Open **Task Scheduler** and choose **Create Task**.
3. On **General**, name the task `TediCross`. Choose the account that can read the project and settings and write to the data directory.
4. On **Triggers**, add **At startup** or **At log on**, depending on your hosting setup.
5. On **Actions**, choose **Start a program**. Set **Program/script** to the full path to `node.exe`, for example `C:\Program Files\nodejs\node.exe`.
6. Set **Add arguments** to:

   ```text
   dist\main.js --config settings.yaml --data-dir data
   ```

7. Set **Start in** to the TediCross project directory, for example `C:\TediCross`.
8. Save the task and use **Run** to check that it starts.

Set `telegram.token` and `discord.token` in `settings.yaml`, or set them to `env` and define `TELEGRAM_BOT_TOKEN` and `DISCORD_BOT_TOKEN` as environment variables inherited by the Windows account running the task. Keep tokens private. Task Scheduler's **History** and the task's **Last Run Result** can help diagnose startup problems.
