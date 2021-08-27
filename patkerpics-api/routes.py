from flask_restplus import Resource, fields, inputs
from flask import Response, request, send_file, stream_with_context, make_response
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, jwt_refresh_token_required, get_jwt_identity,
    get_raw_jwt, set_access_cookies, set_refresh_cookies, unset_access_cookies, unset_refresh_cookies,
)
from flask_jwt_extended.config import config as jwt_config
from sqlalchemy.event import listens_for
from models import *
from hash import hash, verify_hash
from api import app, api, jwt, socket
from db import db
from threading import Thread
from time import time, sleep
import json
import logging
import time

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

clients = {}

@socket.on("connect")
@jwt_required
def connect():

    current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()

    client_id = request.sid
    clients[current_user.id] = client_id

    # images = ImageModel.query.filter_by(user_id=current_user.id).all()

    # socket.emit("initialState", [image.serialize() for image in images], room=client_id)


@socket.on("disconnect")
def disconnect():
    if request.sid in clients:
        del clients[request.sid]


@api.route("/users")
class Users(Resource):
    def get(self):
        return [{"username": user.username, "email": user.email} for user in UserModel.query.all()]


@api.route("/image/<string:title>")
class ImagePost(Resource):
    @jwt_required
    def post(self, title):
        image = request.files['image']
        if "." in image.filename and image.filename.split(".")[-1].lower() in ["png", "jpg", "jpeg"]:
            current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
            image_model = ImageModel(
                user_id=current_user.id,
                title=title
            )
            image_model.save(image)

            socket_id = clients.get(current_user.id)
            if socket_id != None:
                serialized = image_model.serialize()
                socket.emit("addImage", serialized, room=socket_id)
                prev_image = ImageModel.query.filter_by(image_id=serialized["prev"]).first()
                if prev_image != None:
                    socket.emit("updateImage", prev_image.serialize(), room=socket_id)
            return {
                "message": "Image uploaded"
            }
        else:
            return {
                "message": "Invalid file type"
            }, 400


@api.route("/raw_image/<image_uid>")
class StaticImage(Resource):
    @jwt_required
    def get(self, image_uid):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, uid=image_uid).first()
        if image != None:
            return send_file(image.get_path())


@api.route("/image/<int:image_id>/modify")
class ModifyImage(Resource):
    @jwt_required
    def post(self, image_id):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image != None:
            commands = request.get_json()
            for command in commands:
                command["success"] = True
                if command.get("type") == "setTitle":
                    image.title = command.get("title")
                    image.update()
                elif command.get("type") == "addTag":
                    tag = command.get("tag")
                    try:
                        TagModel(image_id=image_id, name=tag).save()
                    except:
                        # Not a unique tag for the image
                        command["success"] = False
                        command["message"] = "Tag already exists"
                elif command.get("type") == "removeTag":
                    tag = command.get("tag")
                    results = TagModel.query.filter_by(image_id=image_id, name=tag)
                    if results.count() > 0:
                        results.first().delete()
                    else:
                        command["success"] = False
                        command["message"] = "Tag does not exist"

            socket_id = clients.get(current_user.id)
            if socket_id != None:
                socket.emit("updateImage", image.serialize(), room=socket_id)

            return commands


# @api.route("/image/<int:image_id>/modify")
# class ModifyImage(Resource):
#     @jwt_required
#     def post(self, image_id):
#         allowed_attributes = ["title"]
#         attributes = request.get_json()
#         current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
#         image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
#         if image != None:
#             serialized = image.serialize()
#             for attribute in attributes:
#                 if attribute in serialized:
#                     setattr(image, attribute, attributes[attribute])
#             image.update()
#
#             socket_id = clients.get(current_user.id)
#             if socket_id != None:
#                 socket.emit("updateImage", image.serialize(), room=socket_id)


@api.route("/image/<int:image_id>")
class Image(Resource):
    @jwt_required
    def get(self, image_id):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        return image.serialize() if image is not None else None

    @jwt_required
    def delete(self, image_id):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image != None:
            serialized = image.serialize()
            image.delete()
            socket_id = clients.get(current_user.id)
            if socket_id != None:
                socket.emit("removeImage", serialized, room=socket_id)
                prev_image = ImageModel.query.filter_by(image_id=serialized["prev"]).first()
                if prev_image != None:
                    socket.emit("updateImage", prev_image.serialize(), room=socket_id)
                next_image = ImageModel.query.filter_by(image_id=serialized["next"]).first()
                if next_image != None:
                    socket.emit("updateImage", next_image.serialize(), room=socket_id)
            return {
                "message": "Image deleted"
            }

@api.route("/images")
class Images(Resource):
    @jwt_required
    def get(self):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        return [
            image.serialize() for image in ImageModel.query.filter_by(user_id=current_user.id).all()
        ]

@api.route("/user_data")
class UserData(Resource):
    @jwt_required
    def get(self):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        return current_user.serialize()

login_parser = api.parser()
login_parser.add_argument("username", type=str, help="Username", location="json", required=True)
login_parser.add_argument("password", type=str, help="Password", location="json", required=True)
@api.route("/login")
class Login(Resource):
    @api.expect(login_parser)
    def post(self):
        args = login_parser.parse_args()
        username = args["username"]
        password = args["password"]
        current_user = UserModel.query.filter_by(username=username).first()
        if not current_user:
            return {
                "message": f"User \"{username}\" does not exist",
            }, 403

        if verify_hash(password, current_user.password):
            access_token = create_access_token(identity=username)
            refresh_token = create_refresh_token(identity=username)
            resp = make_response(json.dumps({
                "message": "Logged in as \"" + username + "\"",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user_data": current_user.serialize()
            }))
            set_access_cookies(resp, access_token)
            # Basically just resets the cookie but with httponly=False so that the client
            # can modify it without an API call.
            # The original function is still called here in order to set the CSRF cookie.
            resp.set_cookie(
                jwt_config.access_cookie_name,
                access_token,
                max_age=jwt_config.cookie_max_age,
                secure=jwt_config.cookie_secure,
                domain=jwt_config.cookie_domain,
                path=jwt_config.access_cookie_path,
                samesite=jwt_config.cookie_samesite,
                httponly=False
            )
            set_refresh_cookies(resp, refresh_token)
            resp.set_cookie(
                jwt_config.refresh_cookie_name,
                refresh_token,
                max_age=jwt_config.cookie_max_age,
                secure=jwt_config.cookie_secure,
                domain=jwt_config.cookie_domain,
                path=jwt_config.access_cookie_path,
                samesite=jwt_config.cookie_samesite,
                httponly=False
            )

            return resp
        else:
            return {
                       "message": f"Invalid password",
                   }, 403

register_parser = api.parser()
register_parser.add_argument("username", type=str, help="Username", location="json", required=True)
register_parser.add_argument("password", type=str, help="Password", location="json", required=True)
register_parser.add_argument("email", type=str, help="Email", location="json", required=True)
# register_parser.add_argument("email", type=inputs.email(check=True), help="Email", location="args", required=True)
@api.route("/register")
class Register(Resource):
    @api.expect(register_parser)
    def post(self):
        args = register_parser.parse_args()
        username = args["username"]
        password = args["password"]
        email = args["email"]

        try:
            inputs.email(check=True)(email)
        except:
            return {
                "message": f"Invalid email."
            }, 403

        if UserModel.query.filter_by(username=username).first():
            return {
                "message": f"User \"{username}\" already exists.",
            }, 403
        if UserModel.query.filter_by(email=email).first():
            return {
                "message": f"User already registered under email \"{email}\"",
            }, 403

        user = UserModel(
            username=username,
            password=hash(password),
            email=email
        )

        try:
            user.save()
            access_token = create_access_token(identity=username)
            refresh_token = create_refresh_token(identity=username)
            resp = make_response(json.dumps({
                "message": "Registered user as \"" + username + "\"",
                "access_token": access_token,
                "refresh_token": refresh_token
            }))
            set_access_cookies(resp, access_token)
            set_refresh_cookies(resp, refresh_token)
            return resp
        except Exception as e:
            print(e)
            return {
                "message": "Internal server error"
            }, 500


@api.route("/refresh")
class RefreshToken(Resource):
    @jwt_refresh_token_required
    def post(self):
        print("RECEIVED REFRESH REQUEST")
        identity = get_jwt_identity()
        access_token = create_access_token(identity=identity)
        resp = make_response(json.dumps({
            "message": "Refreshed token for user \"" + identity + "\"",
            "access_token": access_token
        }))
        set_access_cookies(resp, access_token)
        return resp


@api.route("/logout/access")
class LogoutAccess(Resource):
    @jwt_required
    def post(self):
        jti = get_raw_jwt()["jti"]
        try:
            revoked_token = RevokedTokenModel(jti=jti)
            revoked_token.add()
            return {
                "message": "Access token revoked"
            }
        except:
            return {
                "message": "Failed to revoke access token"
            }, 500


@api.route("/logout/refresh")
class LogoutRefresh(Resource):
    @jwt_refresh_token_required
    def post(self):
        jti = get_raw_jwt()["jti"]
        try:
            revoked_token = RevokedTokenModel(jti=jti)
            revoked_token.add()
            return {
                "message": "Refresh token revoked"
            }
        except:
            return {
                       "message": "Failed to revoke refresh token"
                   }, 500
