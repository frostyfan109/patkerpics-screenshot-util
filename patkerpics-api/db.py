from flask_sqlalchemy import SQLAlchemy
from api import app

DATABASE_URL = "sqlite:///app.db"

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = "85A67C08E0D85F1CE4B8045BB8F6886AE2DE62FC9F925B7FC0EBA522EA2BFE25"

db = SQLAlchemy(app)

@app.before_first_request
def create_tables():
    db.create_all()