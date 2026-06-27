import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asgiref.wsgi
from mangum import Mangum

os.environ.setdefault("FLASK_ENV", "production")

from app import create_app

flask_app = create_app()
asgi_app = asgiref.wsgi.WsgiToAsgi(flask_app)
handler = Mangum(asgi_app, lifespan="off")
