import os
import click
import sentry_sdk
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException, NotFound, MethodNotAllowed, BadRequest, InternalServerError
from dotenv import load_dotenv
from flask_wtf.csrf import CSRFError
from .extensions import db, migrate, login_manager, bcrypt, csrf, cors, socketio
from .utils.cloudinary_upload import init_cloudinary

load_dotenv()


def create_app():
    if os.environ.get("SENTRY_DSN"):
        sentry_sdk.init(
            dsn=os.environ.get("SENTRY_DSN"),
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
        )

    app = Flask(__name__)

    # ── Config ──────────────────────────────────────────────────────────────
    is_testing = os.environ.get("FLASK_ENV") == "testing"
    app.config["TESTING"] = is_testing
    app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["DEBUG"] = os.environ.get("FLASK_ENV") == "development"
    app.config["RATELIMIT_ENABLED"] = not is_testing
    app.config["WTF_CSRF_SSL_STRICT"] = False
    app.config["WTF_CSRF_EXEMPT_LIST"] = ["/socket.io/*"]
    if os.environ.get("FLASK_ENV") == "production":
        app.config["SESSION_COOKIE_SAMESITE"] = "None"
        app.config["SESSION_COOKIE_SECURE"] = True
        app.config["SESSION_COOKIE_HTTPONLY"] = True
        app.config["REMEMBER_COOKIE_SECURE"] = True
        app.config["REMEMBER_COOKIE_SAMESITE"] = "None"
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB hard limit for uploads

    # ── Extensions ──────────────────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    from .extensions import limiter
    limiter.init_app(app)

    csrf.init_app(app)

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return {"error": "CSRF token missing or invalid"}, 400

    @app.errorhandler(NotFound)
    def handle_not_found(e):
        return {"error": "Resource not found"}, 404

    @app.errorhandler(MethodNotAllowed)
    def handle_method_not_allowed(e):
        return {"error": "Method not allowed"}, 405

    @app.errorhandler(BadRequest)
    def handle_bad_request(e):
        return {"error": "Bad request"}, 400

    @app.errorhandler(InternalServerError)
    def handle_internal_error(e):
        return {"error": "Internal server error"}, 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        # Prevent stack trace leakage in all environments
        import traceback
        import sys
        print(f"[Unhandled Exception] {e}", file=sys.stderr)
        traceback.print_exc()
        return {"error": "An unexpected error occurred"}, 500

    init_cloudinary()

    login_manager.init_app(app)

    allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    cors.init_app(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)

    socketio.init_app(
        app,
        cors_allowed_origins=allowed_origins,
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    # ── Login manager ───────────────────────────────────────────────────────
    from .models.user import User
    from .models.admin import Admin
    from .models.follow import Follow

    @login_manager.user_loader
    def load_user(user_id):
        user = User.query.get(user_id)
        if user and user.is_active:
            return user
        return Admin.query.get(user_id)

    login_manager.unauthorized_handler(lambda: ({"error": "Authentication required"}, 401))

    # ── Socket.IO events ─────────────────────────────────────────────────────
    from .socket_events import register_socket_events
    register_socket_events()

    # ── Blueprints ──────────────────────────────────────────────────────────
    from .routes.auth import auth_bp
    from .routes.users import users_bp
    from .routes.swaps import swaps_bp
    from .routes.feedback import feedback_bp
    from .routes.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(swaps_bp, url_prefix="/api/swaps")
    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    # ── Auto-create tables (production first-run) ──────────────────────────
    with app.app_context():
        import sys as _sys
        try:
            db.create_all()
        except Exception as _e:
            print(f"[startup] db.create_all failed: {_e}", file=_sys.stderr)

    # ── Health check ────────────────────────────────────────────────────────
    @app.get("/health")
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            return {"status": "ok", "db": "connected"}
        except Exception:
            # Never leak connection strings or exception details to the client
            return {"status": "degraded", "db": "unavailable"}, 500

    # ── CLI commands ────────────────────────────────────────────────────────
    _register_cli(app)

    return app


def _register_cli(app):
    @app.cli.command("create-admin")
    @click.argument("email")
    @click.argument("password")
    @click.option("--role", default="admin", help="Admin role label")
    def create_admin(email, password, role):
        """Create an admin account. Usage: flask create-admin EMAIL PASSWORD"""
        from .models.admin import Admin
        from .extensions import bcrypt as _bcrypt

        with app.app_context():
            if Admin.query.filter_by(email=email).first():
                click.echo(f"Admin with email {email} already exists.")
                return
            admin = Admin(
                email=email,
                password_hash=_bcrypt.generate_password_hash(password).decode("utf-8"),
                role=role,
            )
            db.session.add(admin)
            db.session.commit()
            click.echo(f"Admin created: {email} (role: {role})")
