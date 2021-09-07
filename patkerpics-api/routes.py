from flask_restplus import Resource, fields, inputs
from flask import Response, request, send_file, stream_with_context, make_response
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, jwt_refresh_token_required, get_jwt_identity,
    get_raw_jwt, unset_access_cookies, unset_refresh_cookies,
    jwt_optional
)
from sqlalchemy.event import listens_for
from rake_nltk import Rake
from models import *
from hash import hash, verify_hash
from api import app, api, jwt, socket
from db import db
from utils import custom_set_access_cookies, custom_set_refresh_cookies
from threading import Thread
from time import time, sleep
from mimetypes import guess_type
from itertools import chain
from fuzzywuzzy import fuzz
from datetime import datetime, timedelta
import search_parser
import json
import logging
import base64
import time
import werkzeug

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

clients = {}

@socket.on("connect")
@jwt_required
def connect():
    try:
        print("CONNECT TEST")

        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()

        client_id = request.sid
        clients[current_user.id] = client_id
    except Exception as e:
        print("foobar", e)
        print(1243132)


    # images = ImageModel.query.filter_by(user_id=current_user.id).all()

    # socket.emit("initialState", [image.serialize() for image in images], room=client_id)

@socket.on("disconnect")
def disconnect():
    if request.sid in clients:
        del clients[request.sid]



def image_not_found(**kwargs):
    vars_str = ", ".join([k + "=" + str(kwargs[k]) for k in kwargs])
    img_str = f"Image<{vars_str}>"
    return {
        "message": f"{img_str} does not exist.",
        "error": True,
        "error_info": {
            "status_code": 404
        }
    }

@api.route("/application_data")
class ApplicationData(Resource):
    def get(self):
        # Return any global application constants the webapp should load into its global state
        # This endpoint will be called indiscriminately on page load
        return {
            "message": "Successfully retrieved application data.",
            "application_data": {
                "search": {
                    "search_qualifiers": search_parser.qualifiers,
                    "qualifier_pattern": search_parser.js_pattern
                }
            }
        }

image_search_parser = api.parser()
image_search_parser.add_argument("q", type=str, help="Search query.", location="args", required=True)
@api.route("/search")
class ImageSearch(Resource):
    @jwt_required
    @api.expect(image_search_parser)
    def get(self):
        args = image_search_parser.parse_args()
        query = args["q"]
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()

        images = ImageModel.query.filter_by(user_id=current_user.id)

        print(query)
        (query, qualifier_groups) = search_parser.search(query)
        query = query.strip()
        print(query)
        for (qualifier, value) in qualifier_groups:
            value = value.replace("+", " ")
            if search_parser.qualifiers.get(qualifier) == "date":
                # The type of qualifier value is a date
                try:
                    # TODO: parse year timestamps (e.g. "2021")
                    timestamp = datetime.strptime(value, "%m-%d-%y")
                except:
                    # Invalid timestamp
                    continue
            if qualifier == "tag":
                # Probably a better way to do this with hybrid_property
                # Manually search images for tags
                images = [image for image in images if any([tag.name.startswith(value) for tag in image.get_tags()])]

                # Convert manual search back into a query
                if len(images) == 0:
                    # Avoid using IN operator on an empty list
                    # Create an empty query
                    images = ImageModel.query.filter(False)
                else:
                    images = ImageModel.query.filter(ImageModel.image_id.in_([image.image_id for image in images]))
            elif qualifier == "app":
                images = images.filter(ImageModel.app.contains(value))
            elif qualifier == "before":
                images = images.filter(ImageModel.timestamp < timestamp)
            elif qualifier == "after":
                images = images.filter(ImageModel.timestamp > timestamp)
            elif qualifier == "date":
                day_after = timestamp + timedelta(days=1)
                images = images.filter((ImageModel.timestamp > timestamp) & (ImageModel.timestamp < day_after))
            else:
                print(f"Unrecognized qualifier: Group<name=\"{qualifier}\", value=\"{value}\">")

        # This should be replaced with an indexed search engine like Whoosh
        # Maybe could also chunk the search query into search terms using NLTK
        # and search using those, but that introduces more room for error.
        if query != "":
            images = images.filter(
                ImageModel.title.contains(query) |
                ImageModel.app.contains(query) |
                ImageModel.ocr_text.contains(query)
            )
        return {
            "message": "Successfully ran search query.",
            "images": [result.uid for result in images.all()]
        }

@api.route("/profile/picture")
class ProfilePicture(Resource):
    @jwt_required
    def put(self):
        image = request.files['image']
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        current_user.save_profile_picture(image)
        return {
            "message": "Successfully set profile picture."
        }
        # Sending an entire image has too much latency, so it's better to just
        # leave it to the client to manually set it.

        # socket_id = clients.get(current_user.id)
        # if socket_id is not None:
        #     socket.emit("updateUserData", {
        #         "profile_picture": current_user.serialize()["profile_picture"]
        #     }, room=socket_id)

image_post_parser = api.parser()
image_post_parser.add_argument("title", type=str, help="Title of the image", location="args", required=True)
image_post_parser.add_argument("app", type=str, help="Active application at time of image capture", location="args", required=True)
image_post_parser.add_argument("image", type=werkzeug.datastructures.FileStorage, help="Image file", location="files", required=True)
@api.route("/image")
class ImagePost(Resource):
    @jwt_required
    @api.expect(image_post_parser)
    def post(self):
        args = image_post_parser.parse_args()
        title = args["title"]
        app = args["app"]
        image = args["image"]
        if "." in image.filename and image.filename.split(".")[-1].lower() in ["png", "jpg", "jpeg"]:
            current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
            image_model = ImageModel(
                user_id=current_user.id,
                title=title,
                app=app
            )
            image_model.save(image)

            socket_id = clients.get(current_user.id)
            if socket_id != None:
                serialized = image_model.serialize()
                socket.emit("addImage", serialized, room=socket_id)
                prev_image = ImageModel.query.filter_by(image_id=serialized["prev"]).first()
                if prev_image != None:
                    socket.emit("updateImage", prev_image.serialize(), room=socket_id)
                    socket.emit("updateUserData", {
                        "bytes_used": current_user.serialize()["bytes_used"]
                    }, room=socket_id)
            return {
                "message": "Image uploaded"
            }
        else:
            return {
                "message": "Invalid file type"
            }, 400


@api.route("/raw_image/<string:image_uid>")
class StaticImage(Resource):
    @jwt_optional
    def get(self, image_uid):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(uid=image_uid).first()
        if image == None:
            return image_not_found(uid=image_uid)
        if image.private == 2:
            if get_jwt_identity() == None or image.user_id != current_user.id:
                return {
                    "message": "You do not have permission to view this image.",
                    "error": True,
                    "error_info": {
                        "status_code": 403
                    }
                }
        return send_file(image.get_path(), mimetype=guess_type(image.filename)[0])

keyword_extraction_parser = api.parser()
keyword_extraction_parser.add_argument("fuzzy_comparison_cutoff",
                                       type=float,
                                       help="Score cutoff (between 0 and 1) to consider a keyword the same as an existing tag. Leave at 1 to disable fuzzing.",
                                       location="args",
                                       required=False,
                                       default=1)
@api.route("/extract_keywords/<int:image_id>")
class KeywordExtraction(Resource):
    @jwt_required
    @api.expect(keyword_extraction_parser)
    def get(self, image_id):
        args = keyword_extraction_parser.parse_args()

        fuzzy_score_cutoff = args["fuzzy_comparison_cutoff"]

        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image is not None:
            if image.ocr_text is None:
                return {
                    "message": "Image OCR scan must be run prior to keyword extraction.",
                    "error": True,
                    "error_info": {
                        "status_code": 409
                    }
                }
            rake = Rake()
            rake.extract_keywords_from_text(image.ocr_text)
            keywords = [{"name": keyword, "score": score, "fuzzed": False} for (score, keyword) in rake.get_ranked_phrases_with_scores()]
            if fuzzy_score_cutoff < 1:
                tags = list(chain.from_iterable([image.get_tags() for image in current_user.get_images()]))
                # This process could probably be replaced with an @hybrid_method and expression* on
                # TagModel to be made much more efficient, but this was faster to implement for now.
                # *Could also maybe be implemented via a UDL
                for keyword in keywords:
                    search = [(tag.name, fuzz.partial_ratio(keyword["name"], tag.name)) for tag in tags]
                    search = [result for result in search if result[1]/100 > fuzzy_score_cutoff]
                    if len(search) > 0:
                        # Sort based on fuzzy scores
                        search.sort(key=lambda s: s[1])
                        # Reverse so that highest scores are first
                        search.reverse()
                        highest_score = search[0][1]
                        # Pick results with the highest result (tied)
                        selected = [s for s in search if s[1] == highest_score]
                        # Sort the tied results by their length
                        selected.sort(key=lambda s: len(s[0]))
                        # Choose the tied result with the shortest length
                        chosen_tag = selected[0]
                        # test
                        keyword["fuzzed"] = True
                        keyword["original_value"] = keyword["name"]
                        keyword["name"] = chosen_tag[0]
                        keyword["fuzzed_score"] = chosen_tag[1]
                        keyword["other_tags"] = [{"name": s[0], "score": s[1]} for s in search if s != chosen_tag]
            return {
                "message": "Successfully extracted keywords.",
                "keywords": keywords
            }
        else:
            return image_not_found(id=image_id)


ocr_parser = api.parser()
ocr_parser.add_argument("rescan", type=inputs.boolean, help="Rescan OCR instead of returning previous data", location="args", required=False)
@api.route("/ocr/<int:image_id>")
class OCRScan(Resource):
    @jwt_required
    @api.expect(ocr_parser)
    def post(self, image_id):
        args = ocr_parser.parse_args()
        rescan = args.get("rescan", False)

        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image is not None:
            ocr_msg = f"Returning already generated OCR data for image<id={image_id}>."
            if image.ocr_text is None or rescan:
                image.run_ocr_scan()
                ocr_msg = f"Successfully ran OCR scan on image<id={image_id}>."
            socket_id = clients.get(current_user.id)
            if socket_id is not None:
                socket.emit("updateImage", image.serialize(), room=socket_id)

            return {
                "message": ocr_msg,
                "ocr_text": image.ocr_text,
                "ocr_boxes": image.ocr_boxes
            }
        else:
            return image_not_found(id=image)

@api.route("/ocr/clear/<int:image_id>")
class ClearOCR(Resource):
    @jwt_required
    def post(self, image_id):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image != None:
            image.ocr_text = None
            image.ocr_boxes = None
            image.update()

            socket_id = clients.get(current_user.id)
            if socket_id is not None:
                socket.emit("updateImage", image.serialize(), room=socket_id)

            return {
                "message": f"Successfully cleared OCR data for image<id={image_id}>."
            }
        else:
            return image_not_found(id=image_id)

"""
@api.route("/image/<int:image_id>/modify")
class ModifyImage(Resource):
    @jwt_required
    def post(self, image_id):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image != None:
            commands = request.get_json()
            for command in commands:
                command["message"] = ""
                command["error"] = False
                if command.get("type") == "setTitle":
                    image.title = command.get("title")
                    image.update()
                    command["message"] = "Successfully set title."
                elif command.get("type") == "addTag":
                    tag = command.get("tag")
                    try:
                        TagModel(image_id=image_id, name=tag).save()
                        command["message"] = "Sucessfully added tag."
                    except:
                        # Not a unique tag for the image
                        command["error"] = True
                        command["message"] = f"Tag<name=\"{tag}\"> already exists."
                elif command.get("type") == "removeTag":
                    tag = command.get("tag")
                    results = TagModel.query.filter_by(image_id=image_id, name=tag)
                    if results.count() > 0:
                        results.first().delete()
                        command["message"] = f"Successfully deleted tag<name=\"{tag}\">."
                    else:
                        command["error"] = True
                        command["message"] = f"Tag<name=\"{tag}\"> does not exist for image<id={image_id}>."

            socket_id = clients.get(current_user.id)
            if socket_id != None:
                socket.emit("updateImage", image.serialize(), room=socket_id)

            return commands
"""

modify_image_parser = api.parser()
modify_image_parser.add_argument("type", type=str, help="Type of modification to make to the image.", location="json", required=True)
@api.route("/image/<int:image_id>/modify")
class ModifyImage(Resource):
    @jwt_required
    @api.expect(modify_image_parser)
    def post(self, image_id):
        args = modify_image_parser.parse_args()
        type = args["type"]

        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(user_id=current_user.id, image_id=image_id).first()
        if image != None:
            body = request.get_json()

            response = {
                "message": "",
                "error": False
            }

            if type == "setTitle":
                image.title = body.get("title")
                image.update()
                response["message"] = "Successfully set title."
            elif type == "addTags":
                tags = body.get("tags")
                try:
                    for tag in tags:
                        TagModel(image_id=image_id, name=tag).save()
                    response["message"] = "Successfully added all tags."
                except:
                    response["error"] = True
                    response["message"] = f"Tag<name=\"{tag}\"> already exists."
            elif type == "addTag":
                tag = body.get("tag")
                try:
                    TagModel(image_id=image_id, name=tag).save()
                    response["message"] = "Sucessfully added tag."
                except:
                    # Not a unique tag for the image
                    response["error"] = True
                    response["message"] = f"Tag<name=\"{tag}\"> already exists."
            elif type == "removeTag":
                tag = body.get("tag")
                results = TagModel.query.filter_by(image_id=image_id, name=tag)
                if results.count() > 0:
                    results.first().delete()
                    response["message"] = f"Successfully deleted tag<name=\"{tag}\">."
                else:
                    response["error"] = True
                    response["message"] = f"Tag<name=\"{tag}\"> does not exist for image<id={image_id}>."

            if response["error"]:
                response["error_info"] = {
                    "status_code": 400
                }

            socket_id = clients.get(current_user.id)
            if socket_id is not None:
                socket.emit("updateImage", image.serialize(), room=socket_id)

            return response
        else:
            return image_not_found(id=image_id)


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


@api.route("/image/<string:image_uid>")
class Image(Resource):
    @jwt_optional
    def get(self, image_uid):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        image = ImageModel.query.filter_by(uid=image_uid).first()
        details = True
        not_owner = get_jwt_identity() == None or image.user_id != current_user.id
        if image is None:
            return image_not_found(uid=image_uid)

        if image.private == 2:
            if not_owner:
                return {
                    "message": "You do not have permission to view this image.",
                    "error": True,
                    "error_info": {
                        "status_code": 403
                    }
                }
        if image.private == 1:
            if not_owner:
                details = False

        return {
            "message": "Success",
            "image": image.serialize(details=details, hide_next_prev=not_owner)
        }

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
                socket.emit("updateUserData", {
                    "bytes_used": current_user.serialize()["bytes_used"]
                }, room=socket_id)
            return {
                "message": "Image deleted"
            }

@api.route("/images")
class Images(Resource):
    @jwt_required
    def get(self):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        return {
            "message": "Success",
            "images": [image.serialize() for image in ImageModel.query.filter_by(user_id=current_user.id).all()]
        }

@api.route("/user_data")
class UserData(Resource):
    @jwt_required
    def get(self):
        current_user = UserModel.query.filter_by(username=get_jwt_identity()).first()
        user_data = current_user.serialize()
        return {
            "message": "Success",
            "user_data": user_data,
        }

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
                "error": True,
                "error_info": {
                    "status_code": 422
                }
            }

        if verify_hash(password, current_user.password):
            access_token = create_access_token(identity=username)
            refresh_token = create_refresh_token(identity=username)
            resp = make_response(json.dumps({
                "message": "Logged in as \"" + username + "\"",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user_data": current_user.serialize()
            }))
            custom_set_access_cookies(resp, access_token)
            custom_set_refresh_cookies(resp, refresh_token)

            return resp
        else:
            return {
                "message": f"Invalid password.",
                "error": True,
                "error_info": {
                    "status_code": 422
                }
            }

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
                "message": f"Invalid email.",
                "error": True,
                "error_info": {
                    "status_code": 422
                }
            }

        if UserModel.query.filter_by(username=username).first():
            return {
                "message": f"User \"{username}\" already exists.",
                "error": True,
                "error_info": {
                    "status_code": 422
                }
            }
        if UserModel.query.filter_by(email=email).first():
            return {
                "message": f"User already registered under email \"{email}\"",
                "error": True,
                "error_info": {
                    "status_code": 422
                }
            }

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
            custom_set_access_cookies(resp, access_token)
            custom_set_refresh_cookies(resp, refresh_token)
            return resp
        except Exception as e:
            print(e)
            return {
                "message": "Internal server error",
                "error": True,
                "error_info": {
                    "status_code": 500
                }
            }


@api.route("/refresh")
class RefreshToken(Resource):
    @jwt_refresh_token_required
    def post(self):
        identity = get_jwt_identity()
        access_token = create_access_token(identity=identity)
        refresh_token = create_refresh_token(identity=identity)
        resp = make_response(json.dumps({
            "message": "Refreshed token for JWT \"" + identity + "\"",
            "access_token": access_token,
            "refresh_token": refresh_token
        }))
        custom_set_access_cookies(resp, access_token)
        custom_set_refresh_cookies(resp, refresh_token)
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
