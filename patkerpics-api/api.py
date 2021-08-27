import logging
from flask import Flask, jsonify
from flask_restplus import Api
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from config import SERVER_HOST
from credentials import JWT_SECRET_KEY
import datetime
from jwt.exceptions import ExpiredSignatureError


app = Flask(__name__)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', SERVER_HOST + ":3000")
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response
# CORS(app, resources={r"/*": {"origins": "*"}})
socket = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

app.config['JWT_TOKEN_LOCATION'] = ['cookies', 'headers']
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = datetime.timedelta(weeks=4)

jwt = JWTManager(app)

api = Api(app)
