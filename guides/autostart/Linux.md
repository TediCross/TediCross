Setup as a service on Linux
===========================

In GNU/Linux, the recommended way of setting up the bot as a service is using [systemd](https://en.wikipedia.org/wiki/Systemd). It is installed by default on all distros I've used, from both the Debian and Red Hat branches of Linux

Setting TediCross up as a service means it will automatically start during boot, and will also try to restart itself if it crashes.

Only the first part (Setting up the service) is strictly necessary, but the rest give you nice log files


Setting up the service
----------------------

The setup is quite simple. Make the file `/etc/systemd/system/tedicross.service` and populate it with the following:

```
[Service]
ExecStart=/usr/bin/npm start
WorkingDirectory=/home/tedicross/TediCross
Restart=always
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=tedicross
User=tedicross
Group=tedicross
Environment=TELEGRAM_BOT_TOKEN=secret
Environment=DISCORD_BOT_TOKEN=secret

[Install]
WantedBy=multi-user.target
```

Adjust the file to suit your needs. I have TediCross running as a dedicated user `tedicross`, but you can use any user. `root` will work, but is NOT recommended!

Also point `WorkingDirectory` to wherever your TediCross files are

You can, if you want to, supply the bot tokens through the service file. Put them at their respective lines in the file. This requires that `token` in TediCross' `settings.json` is set to `"env"`. If you prefer to give the tokens through `settings.json`, just remove the two lines starting with `Environment`

When you are happy with the file, run the command `systemctl enable tedicross`. This activates the service. You can then control the service and check its status with the commands `systemctl start|stop|restart|status tedicross` (pick one of the middle words).

Note that after editing the service file, you need to run the command `systemctl daemon-reload` followed by `systemctl restart tedicross` to apply them


Output
------

Output from the bot ends up in the system log, i.e. `/var/log/messages` along with a lot of other system stuff. TediCross' messages can be identified by the identifier `tedicross`, set in the service file.

You can also redirect the output to its own, dedicated log file. To do this, make the file `/etc/rsyslog.d/tedicross.conf` and put the following into it:

```
if $programname == 'tedicross' then /var/log/tedicross/tedicross.log
if $programname == 'tedicross' then ~
```

Then run the command `systemctl restart rsyslog`.

You then get a nice log file at `/var/log/tedicross/tedicross.log`, as indicated by the file


Logrotate
---------

The log file `/var/log/tedicross/tedicross.log` will just grow and grow and grow. It might therefore be a good idea to set up `logrotate` for it. `logrotate` chops the log file into individual days and deletes them after they become too old.

To set it up, create the file `/etc/logrotate.d/tedicross` and put the following into it:

```
/var/log/tedicross/tedicross.log {
  rotate 12
  daily
  compress
  missingok
  notifempty
}
```

That's it! You will now get nicely rotated logs which will not consume every single byte of your disk if left running long enough
