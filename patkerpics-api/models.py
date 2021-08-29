import os
from shutil import rmtree
from datetime import datetime, timezone
from db import db
from secrets import token_urlsafe
from PIL import Image
from io import BytesIO

class Model(db.Model):
    __abstract__ = True

    def serialize(self):
        return {
            n.name: getattr(self, n.name) for n in self.__table__.columns
        }

    def update(self):
        db.session.commit()

    def save(self):
        db.session.add(self)
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

    def save(self):
        super().save()

        os.mkdir(os.path.join("images", str(self.id)))

    def delete(self):
        rmtree(os.path.join("images", str(self.id)))

        super().delete()

    def get_bytes_used(self):
        # This could be updated to be a databsae column which is updated by
        # a difference in bytes whenever an image is uploaded/deleted.
        # For now, this is a better method since images may get deleted directly
        # from the database causing desync in this value if it were recorded
        # rather than generated.
        return sum([img.file_size for img in self.get_images()])

    def serialize(self):
        return {
            "username": self.username,
            "email": self.email,
            "created": self.created.timestamp(),
            "bytes_used": self.get_bytes_used()
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

class ImageModel(Model):
    __tablename__ = "images"
    image_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, unique=False, nullable=False)
    filename = db.Column(db.String(255), unique=False, nullable=False)
    timestamp = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255), unique=False, nullable=False)
    uid = db.Column(db.String(32), unique=True, nullable=False, default=generate_image_token)
    bit_depth = db.Column(db.Integer, unique=False, nullable=False)
    width = db.Column(db.Integer, unique=False, nullable=False)
    height = db.Column(db.Integer, unique=False, nullable=False)
    # Stores file size in bytes
    file_size = db.Column(db.Integer, unique=False, nullable=False)
    file_type = db.Column(db.String, unique=False, nullable=False)
    ocr_text = db.Column(db.String, nullable=True)
    ocr_boxes = db.Column(db.String, nullable=True)


    """
    Saves an image to the file system and database
    
    Args:
        image (werkzeug.datastructure.FileStorage): The image to be saved to the file system.
    """
    def save(self, image):

        file_type = image.filename.split(".")[-1].lower()
        pil_img = Image.open(image)

        self.timestamp = datetime.now(tz=timezone.utc).timestamp()
        self.filename = str(len(os.listdir(self.get_dir()))) + "." + image.filename.split(".")[-1];
        # If the image mode is unknown for whatever reason, null it.
        self.bit_depth = ({'1':1, 'L':8, 'P':8, 'RGB':"24", 'RGBA':32, 'CMYK':32, 'YCbCr':32, 'I':32, 'F':32}).get(pil_img.mode, -1)
        self.width = pil_img.width
        self.height = pil_img.height
        self.file_type = file_type

        pil_img.save(self.get_path())
        # image.save(self.get_path())
        self.file_size = os.path.getsize(self.get_path())

        super().save()

    def delete(self):
        os.remove(self.get_path())

        super().delete()

    def get_tags(self):
        return TagModel.query.filter_by(image_id=self.image_id).all()

    def get_dir(self):
        return os.path.join("images", str(self.user_id))

    def get_path(self):
        return os.path.join(self.get_dir(), self.filename)

    def serialize(self):
        images = ImageModel.query.filter_by(user_id=self.user_id).order_by("timestamp").all()
        index = images.index(self)
        if index == len(images) - 1:
            next = None
        else:
            next = images[index+1].image_id
        if index == 0:
            prev = None
        else:
            prev = images[index-1].image_id
        return {
                "id": self.image_id,
                # Format timestamp for usage with JS Date API
                "timestamp": self.timestamp * 1000,
                "title": self.title,
                "tags": [tag.name for tag in self.get_tags()],
                "uid": self.uid,
                "bit_depth": self.bit_depth,
                "width": self.width,
                "height": self.height,
                "file_type": self.file_type,
                "file_size": self.file_size,
                "ocr_text": self.ocr_text,
                "ocr_boxes": self.ocr_boxes,
                "next": next,
                "prev": prev
            }


class RevokedTokenModel(Model):
    __tablename__ = "revoked-tokens"
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(120))

    @classmethod
    def is_jti_blacklisted(cls, jti):
       return cls.query.filter_by(jti=jti).first() == None
