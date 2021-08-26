import os
from shutil import rmtree
from datetime import datetime, timezone
from db import db

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

    def get_images(self):
        return ImageModel.query.filter_by(user_id=self.id).all()

    def save(self):
        super().save()

        os.mkdir(os.path.join("images", str(self.id)))

    def delete(self):
        rmtree(os.path.join("images", str(self.id)))

        super().save()


class TagModel(Model):
    tag_id = db.Column(db.Integer, primary_key=True)
    image_id = db.Column(db.Integer, unique=False, nullable=False)
    name = db.Column(db.String(255), unique=False, nullable=False)

    def save(self):
        # Check that name is unique for given image
        if TagModel.query.filter_by(image_id=self.image_id, name=self.name).count() > 0:
            raise Exception("Tag already exists")
        super().save()


class ImageModel(Model):
    __tablename__ = "images"
    image_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, unique=False, nullable=False)
    filename = db.Column(db.String(255), unique=False, nullable=False)
    timestamp = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255), unique=False, nullable=False)

    """
    Saves an image to the file system an database
    
    Args:
        image (werkzeug.datastructure.FileStorage): The image to be saved to the file system.
    """
    def save(self, image):
        self.timestamp = datetime.now(tz=timezone.utc).timestamp()
        self.filename = str(len(os.listdir(self.get_dir()))) + "." + image.filename.split(".")[-1];
        image.save(self.get_path())

        super().save()

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
