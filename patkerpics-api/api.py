import logging
from flask import Flask, jsonify, request
from flask_restplus import Api
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, get_raw_jwt, get_jwt_identity, jwt_required,
    verify_jwt_refresh_token_in_request, create_access_token,
    create_refresh_token, verify_jwt_in_request, decode_token
)
from jwt import decode
from flask_socketio import SocketIO
from config import SERVER_HOST
from credentials import JWT_SECRET_KEY
from utils import custom_set_access_cookies, custom_set_refresh_cookies
from datetime import datetime, timedelta, timezone
import json

app = Flask(__name__)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', SERVER_HOST + ":3000")
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Expose-Headers', 'Update-Access-Token, Update-Refresh-Token')

    data = response.get_json()
    if isinstance(data, dict) and data.get("msg") is not None:
        # print(get_jwt_identity())
        data["message"] = data["msg"]
        data["error"] = True
        data["error_info"] = {
            "status_code": 401,
            "jwt_authentication_error": True
        }
        del data["msg"]
        response.status_code = 200
        response.data = json.dumps(data)

    # try:
    #     _cookies = request.cookies
    #     # For some inexplicable reason, flask-jwt-extended decided it would only accept
    #     # an access cookie OR a refresh cookie but not both at once??
    #     request.cookies = {
    #         "refresh_token_cookie": _cookies.get("refresh_token_cookie"),
    #         "csrf_refresh_token": _cookies.get("csrf_refresh_token")
    #     }
    #     verify_jwt_refresh_token_in_request()
    #     request.cookies = _cookies
    #     access_token = request.cookies.get("access_token_cookie")
    #     identity = get_jwt_identity()
    #     if identity is not None and access_token is not None:
    #         access_token = decode_token(access_token, allow_expired=True)
    #         exp_time = access_token["exp"]
    #         now = datetime.now()
    #         target_time = datetime.timestamp(now + timedelta(minutes=5))
    #         if target_time > exp_time:
    #             access_token = create_access_token(identity=identity)
    #             # refresh_token = create_refresh_token(identity=identity)
    #             custom_set_access_cookies(response, access_token)
    #             # Automatically update the cookie that the webapp uses to track the token.
    #             custom_set_access_cookies(response, access_token, "access_token")
    #             # custom_set_refresh_cookies(response, refresh_token)
    #         if now.timestamp() > exp_time:
    #             pass
    #             # response.headers.add("Location", request.path)
    #             # response.status_code = 302
    # except Exception as e:
    #     print(e)
    #
    return response

class JWTAuthMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        _req = environ["werkzeug.request"]

        access_token = _req.cookies.get("access_token_cookie") or _req.cookies.get("refresh_token")
        refresh_token = _req.cookies.get("refresh_token_cookie") or _req.cookies.get("refresh_token")

        created_new_tokens = False

        try:
            access_jwt = decode(access_token, JWT_SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
            refresh_jwt = decode(refresh_token, JWT_SECRET_KEY)

            identity = access_jwt.get("identity")

            if identity is not None:
                exp_time = access_jwt["exp"]
                now = datetime.now()
                target_time = datetime.timestamp(now + timedelta(minutes=5))
                if target_time > exp_time:
                    environ["HTTP_AUTHORIZATION"] = "Bearer " + refresh_token
                    with app.request_context(environ):
                        access_token = create_access_token(identity=identity)
                        # refresh_token = create_refresh_token(identity=identity)
                        environ["HTTP_AUTHORIZATION"] = "Bearer " + access_token
                        created_new_tokens = True
                        print("set authorization")
                        # print(environ)
            else:
                print("no identity")

        except Exception as e:
            # print(e)
            pass

        def new_start_response(status, response_headers, exc_info=None):
            with app.app_context():
                if created_new_tokens:
                    refresh_token = create_refresh_token(identity=identity)
                    response_headers.append(("Update-Access-Token", access_token))
                    response_headers.append(("Update-Refresh-Token", refresh_token))

            return start_response(status, response_headers, exc_info)

        return self.wsgi_app(environ, new_start_response)

# CORS(app, resources={r"/*": {"origins": "*"}})
socket = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=5)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(weeks=4)

jwt = JWTManager(app)

api = Api(app)

app.wsgi_app = JWTAuthMiddleware(app.wsgi_app)