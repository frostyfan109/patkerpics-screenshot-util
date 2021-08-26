import logging
from flask import Flask, jsonify
from flask_restplus import Api
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
import datetime
from jwt.exceptions import ExpiredSignatureError


app = Flask(__name__)
CORS(app)
socket = SocketIO(app, cors_allowed_origins="*")

app.config['JWT_TOKEN_LOCATION'] = ['headers', 'query_string']
app.config['JWT_SECRET_KEY'] = "669E2C9A6828A928071176FE0755249E6D86DAAB37BFFAC446840538D7147CB6"
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = datetime.timedelta(weeks=4)

jwt = JWTManager(app)

api = Api(app)
