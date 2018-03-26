# Setup autostart on Windows

Hi, this is a short guide on how to make your TediCross bot instance start up automatically whenever you start or restart your computer.

* Search for "Task Scheduler" in the start menu, open it
* Click "Task Scheduler Library"
* Right-click on the empty space
* Pick "Create New Task"
* Enter a name (`TediCross` is fine)
* Select "Run whether user is logged on or not"
* Click the "Triggers" tab
* Click "New..."
* Pick "At startup" from the dropdown-menu at the top
* Click "OK"
* Click the "Actions" tab
* Click "New..."
* Enter `"C:\Program Files\nodejs\node.exe"` in "Program/script:"
* Enter `main.js` in "Add arguments (optional):"
* Enter `C:\Path\to\bot\folder` in "Start in (optional):"
* Click "OK"
* Click "OK"
* Enter your Windows username / password if Task Scheduler asks for it
* Right-click on your task
* Click "Run"
