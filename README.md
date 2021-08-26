# Patkerpics Screenshot Utility

Patkerpics is a screenshot utility consisting 3 components:
* Java screenshotting appliance
* Webapp for viewing screenshots
* Server/REST API

### Appliance
The [screenshotting appliance](./patkerpics-appliance) (incomplete) runs as a background application and is activated
via a shortcut (e.g. Ctrl+Shift+C). This allows a user to capture a selected portion of their screen and automatically upload it to their account.

### Webapp
The [webapp](./Patkerpics) is built using Typescript, React, Redux, and Bootstrap 4. It allows a user to view their screenshots and associated metadata and categorize/sort them using titles and tags. The project was bootstrapped using Create React App.

### Flask Server/REST API
The [Patkerpics Server & API](./patkerpics-api) are built in using Flask and Flask-RESTPlus.The API faciliates all interactions between the appliance, website, and server.
- The server comes bundled with SocketIO to provide real-time updates to webapp clients.
- Authenciation is handled using JWT's with Flask-JWT-Extended.
- SQLAlcehmy is used for database ORM with SQLite.

# Usage
- The server can be launched by running `main.py` in the `patkerpics-api` directory using Python 3.7.x. Refer to the [file](./patkerpics-api) for available arguments.
- The webapp can be launched by running `npm start` in the `Patkerpics/web` directory.