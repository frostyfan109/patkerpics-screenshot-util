PYTHON = python

source .env

install.python:
	cd patkerpics-api
	${PYTHON} -m vent venv
	source "venv/bin/activate"
	${PYTHON} -m pip install -r requirements.txt

install.npm:
	cd Patkerpics/web
	npm install

install:
	install.python
	install.npm

run.api:
	cd patkerpics-api
	source "venv/bin/activate"
	python main.py -r

run.web:
	cd Patkerpics/web
	npm start