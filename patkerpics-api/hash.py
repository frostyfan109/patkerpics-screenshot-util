from passlib.hash import pbkdf2_sha256 as sha256

def hash(raw):
    return sha256.hash(raw)

def verify_hash(raw, hashed):
    return sha256.verify(raw, hashed)