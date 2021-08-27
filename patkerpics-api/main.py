import argparse
import logging
from api import app
from config import SERVER_HOST
import routes

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Specify API arguments")
    parser.add_argument("--host", action="store")
    parser.add_argument("--port", action="store", default=8001, type=int)
    parser.add_argument("-r", "--reloader", help="Automatically restart API upon modification", action="store_true", default=True)
    args = parser.parse_args()

    app.run(
        host=args.host,
        port=args.port,
        threaded=True,
        debug=True,
        use_reloader=args.reloader
    )
