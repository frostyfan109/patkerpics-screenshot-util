from flask_jwt_extended import set_access_cookies, set_refresh_cookies
from flask_jwt_extended.config import config as jwt_config

def custom_set_access_cookies(resp, access_token, custom_name=None):
    set_access_cookies(resp, access_token)
    # Basically just resets the cookie but with httponly=False so that the client
    # can modify it without an API call.
    # The original function is still called here in order to set the CSRF cookie.
    resp.set_cookie(
        custom_name or jwt_config.access_cookie_name,
        access_token,
        max_age=jwt_config.cookie_max_age,
        secure=jwt_config.cookie_secure,
        domain=jwt_config.cookie_domain,
        path=jwt_config.access_cookie_path,
        samesite=jwt_config.cookie_samesite,
        httponly=False
    )

def custom_set_refresh_cookies(resp, refresh_token):
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