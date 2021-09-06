import os
import json
import base64
from collections import Counter
from itertools import chain
from shutil import rmtree
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timezone
from db import db
from secrets import token_urlsafe
from mimetypes import guess_type
from PIL import Image
from pytesseract import image_to_string, image_to_data, Output
from io import BytesIO

class Model(db.Model):
    __abstract__ = True

    def serialize(self):
        return {
            n.name: getattr(self, n.name) for n in self.__table__.columns
        }

    def update(self):
        db.session.commit()

    def _save_to_db(self):
        db.session.add(self)

    def save(self):
        self._save_to_db()
        self.update()

    def delete(self):
        db.session.delete(self)
        self.update()


class UserModel(Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(13), unique=True, nullable=False)
    password = db.Column(db.String(255), unique=False, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    created = db.Column(db.DateTime, unique=False, nullable=False, default=datetime.now)

    def get_images(self):
        return ImageModel.query.filter_by(user_id=self.id).all()

    def get_images_path(self):
        return os.path.join("images", str(self.id))

    def get_profile_path(self):
        return os.path.join(self.get_images_path(), "profile_picture")

    def get_profile_picture_path(self):
        return os.path.join(self.get_profile_path(), "profile.png")

    def has_profile_picture(self):
        return os.path.isfile(self.get_profile_picture_path())

    def get_profile_picture_b64(self):
        if not self.has_profile_picture():
            return None
        with open(self.get_profile_picture_path(), "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

    def save(self):
        super().save()

        os.mkdir(self.get_images_path())
        os.mkdir(self.get_profile_path())

    def delete(self):
        rmtree(self.get_images_path())

        super().delete()

    def save_profile_picture(self, image):
        image.save(self.get_profile_picture_path())

    def get_bytes_used(self):
        # This could be updated to be a databsae column which is updated by
        # a difference in bytes whenever an image is uploaded/deleted.
        # For now, this is a better method since images may get deleted directly
        # from the database causing desync in this value if it were recorded
        # rather than generated.
        return sum([img.file_size for img in self.get_images()])

    def get_qualifier_data(self):
        images = self.get_images()
        tag_values = Counter([tag.name.replace(" ", "+") for tag in chain.from_iterable([image.get_tags() for image in images])])
        app_values = Counter([image.app.replace(" ", "+") for image in images])
        # Sort s.t. newest images appear first
        images.sort(key=lambda image: image.timestamp.timestamp(), reverse=True)
        newest_image = images[0] if len(images) > 0 else None
        oldest_image = images[-1] if len(images) > 0 else None
        return {
            "qualifier_values": {
                "tag": list(tag_values.keys()),
                "app": list(app_values.keys()),
                "before": newest_image.timestamp.timestamp(),
                "after": oldest_image.timestamp.timestamp(),
                "date": None
            },
            "qualifier_value_frequency": {
                "tag": list(tag_values.values()),
                "app": list(app_values.values()),
                "before": None,
                "after": None,
                "date": None
            }

        }

    def serialize(self):
        return {
            "username": self.username,
            "email": self.email,
            "created": self.created.timestamp(),
            **self.get_qualifier_data(),
            "bytes_used": self.get_bytes_used(),
            "profile_picture": self.get_profile_picture_b64()
        }

    def serialize_public(self):
        return {
            "username": self.username,
            "profile_picture": self.get_profile_picture_b64()
        }


class TagModel(Model):
    tag_id = db.Column(db.Integer, primary_key=True)
    image_id = db.Column(db.Integer, unique=False, nullable=False)
    name = db.Column(db.String(255), unique=False, nullable=False)

    def save(self):
        # Check that name is unique for given image
        if TagModel.query.filter_by(image_id=self.image_id, name=self.name).count() > 0:
            raise Exception("Tag already exists")
        super().save()

def generate_image_token():
    token = token_urlsafe(32)
    if ImageModel.query.filter_by(uid=token).first():
        # Recurse if the token is already in use
        return generate_image_token()
    else:
        return token

PUBLIC = 0
HIDDEN = 1
PRIVATE = 2

class ImageModel(Model):
    __tablename__ = "images"
    "Internal-facing primary key for an image record. Used for nearly all API interactions."
    image_id = db.Column(db.Integer, primary_key=True)
    """ Externally-facing (unique) key for an image record. Used for select API interactions where
    the id is externally exposed (i.e. a raw image URL). Also used for system filenames, although
    this choice is completely arbitrary. """
    uid = db.Column(db.String(32), unique=True, nullable=False)
    user_id = db.Column(db.Integer, unique=False, nullable=False)
    filename = db.Column(db.String(255), unique=False, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    title = db.Column(db.String(255), unique=False, nullable=False)
    bit_depth = db.Column(db.Integer, unique=False, nullable=False)
    width = db.Column(db.Integer, unique=False, nullable=False)
    height = db.Column(db.Integer, unique=False, nullable=False)
    # Stores file size in bytes
    file_size = db.Column(db.Integer, unique=False, nullable=False)
    private = db.Column(db.Integer, unique=False, nullable=False)
    # file_type = db.Column(db.String, unique=False, nullable=False)
    ocr_text = db.Column(db.String, nullable=True, default=None)
    ocr_boxes = db.Column(db.String, nullable=True, default=None)
    app = db.Column(db.String, nullable=False)

    """
    Runs an OCR scan on the image using Tesseract and
    saves the data to its `ocr_text` and `ocr_boxes` columns.
    
    Returns:
        ocr_data (tuple): ocr_text, ocr_boxes
    """
    def run_ocr_scan(self):
        image = Image.open(self.get_path())
        self.ocr_text = image_to_string(image).strip()
        self.ocr_boxes = json.dumps(image_to_data(image, output_type=Output.DICT))

        print("OCR text:", self.ocr_text)
        print("OCR boxes:", self.ocr_boxes)

        self.update()

        return self.ocr_text, self.ocr_boxes

    """
    Saves an image to the file system and database
    
    Args:
        image (werkzeug.datastructure.FileStorage): The image to be saved to the file system.
    """
    def save(self, image):
        file_extension = image.filename.split(".")[-1].lower()
        pil_img = Image.open(image)

        self.timestamp = datetime.now(tz=timezone.utc)
        # self.filename = str(len(os.listdir(self.get_dir()))) + "." + image.filename.split(".")[-1];
        # If the image mode is unknown for whatever reason, null it.
        self.bit_depth = ({'1':1, 'L':8, 'P':8, 'RGB':"24", 'RGBA':32, 'CMYK':32, 'YCbCr':32, 'I':32, 'F':32}).get(pil_img.mode, -1)
        self.width = pil_img.width
        self.height = pil_img.height
        # self.file_type = mime_type
        self.uid = generate_image_token()
        self.private = 0
        # Technically redundant now but too much work to remove.
        self.filename = self.uid + "." + image.filename.split(".")[-1]
        # This column can be quickly derived from the `filename` column,
        # and there's no situation in which a client would only have access
        # to one or the other.
        # self.file_type = guess_type(self.filename)[0]
        pil_img.save(self.get_path())
        # image.save(self.get_path())
        self.file_size = os.path.getsize(self.get_path())


        super().save()

    @hybrid_property
    def tags(self):
        return TagModel.query.filter_by(image_id=self.image_id)

    def delete(self):
        os.remove(self.get_path())

        super().delete()

    def get_tags(self):
        return TagModel.query.filter_by(image_id=self.image_id).all()

    def get_dir(self):
        return os.path.join("images", str(self.user_id))

    def get_path(self):
        return os.path.join(self.get_dir(), self.filename)

    def serialize(self, details=True, hide_next_prev=False):
        images = ImageModel.query.filter_by(user_id=self.user_id).order_by("timestamp").all()
        index = images.index(self)
        if index == len(images) - 1:
            next = None
        else:
            next = images[index+1].uid
        if index == 0:
            prev = None
        else:
            prev = images[index-1].uid
        return {
                "id": self.image_id,
                # Format timestamp for usage with JS Date API
                "timestamp": self.timestamp.timestamp() * 1000,
                "title": self.title if details else None,
                "tags": [tag.name for tag in self.get_tags()] if details else None,
                "uid": self.uid,
                "bit_depth": self.bit_depth,
                "width": self.width,
                "height": self.height,
                # "file_type": self.file_type,
                "filename": self.filename,
                "file_size": self.file_size,
                "app": self.app,
                "ocr_text": self.ocr_text,
                "ocr_boxes": self.ocr_boxes if self.ocr_boxes == None else json.loads(self.ocr_boxes),
                "private": self.private,
                "next": next if (details and not hide_next_prev) else None,
                "prev": prev if (details and not hide_next_prev) else None,
                "author": UserModel.query.filter_by(id=self.user_id).first().serialize_public()
            }


class RevokedTokenModel(Model):
    __tablename__ = "revoked-tokens"
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(120))

    @classmethod
    def is_jti_blacklisted(cls, jti):
       return cls.query.filter_by(jti=jti).first() == None
