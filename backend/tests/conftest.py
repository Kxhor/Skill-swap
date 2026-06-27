import os
import pytest
from app.extensions import db as _db
from app.models.user import User
from app.models.admin import Admin
from app.models.skill import Skill
from app.models.user_skill import UserSkill
from app.models.swap_request import SwapRequest
from app.models.chat import ChatMessage
from app.models.feedback import Feedback
from app.models.availability import Availability
from app.models.match_score import MatchScore
from app.models.verified_badge import VerifiedBadge
from app.models.scheduled_session import ScheduledSession


@pytest.fixture(scope="session")
def app():
    os.environ["SECRET_KEY"] = "test-secret-key"
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:5173"

    from app import create_app
    application = create_app()
    application.config["TESTING"] = True

    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture
def client(app):
    client = app.test_client()
    resp = client.get("/auth/csrf-token")
    token = resp.get_json()["csrf_token"]
    client.environ_base["HTTP_X_CSRFTOKEN"] = token
    return client


@pytest.fixture(autouse=True)
def _push_request_context():
    """Override pytest-flask's autouse fixture — we don't need a pre-pushed request context."""
    return


@pytest.fixture(autouse=True)
def db_session(app):
    """Clean the database between tests."""
    with app.app_context():
        _db.create_all()
        yield _db.session
        _db.session.rollback()
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


@pytest.fixture
def auth_headers(client):
    """Register and login a test user, return dict with cookies."""
    client.post("/auth/register", json={
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "password123",
    })
    return {}  # Flask-Login uses session cookies, no manual headers needed


@pytest.fixture
def logged_in_client(client, auth_headers):
    """Return a test client that's already logged in."""
    return client


@pytest.fixture
def second_user(client):
    """Register a second user for swap tests."""
    client.post("/auth/register", json={
        "name": "Second User",
        "email": "second@example.com",
        "password": "password123",
    })
    return client


@pytest.fixture
def admin_client(client):
    """Create an admin and return logged-in client."""
    with client.application.app_context():
        from app.extensions import bcrypt
        admin = Admin(
            email="admin@test.com",
            password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
            role="admin",
        )
        _db.session.add(admin)
        _db.session.commit()

    client.post("/auth/admin/login", json={
        "email": "admin@test.com",
        "password": "admin123",
    })
    return client


# ── Socket.IO test helpers (single-client pattern) ─────────────────────────

def _register_on(client, name, email, password="password123"):
    """Register a new user on the existing test client (already has CSRF token)."""
    resp = client.post("/auth/register", json={
        "name": name, "email": email, "password": password,
    })
    assert resp.status_code == 201, f"Registration failed for {email}: {resp.get_json()}"


def _login_as(client, email, password="password123"):
    """Login as a user on the shared client. Updates session in-place."""
    resp = client.post("/auth/login", json={
        "email": email, "password": password,
    })
    assert resp.status_code in (200, 201), f"Login failed for {email}: {resp.get_json()}"


def _create_socket(flask_client, user_email):
    """Create a Socket.IO test client sharing the Flask client's session cookie."""
    from app.extensions import socketio
    app = flask_client.application
    sio = socketio.test_client(app, flask_test_client=flask_client)
    if not sio.is_connected():
        pytest.fail(f"Socket connection failed for {user_email}")
    from app.models.user import User
    with app.app_context():
        user = User.query.filter_by(email=user_email).first()
        sio.user_id = user.id if user else None
    sio.client = flask_client
    sio.app = app
    return sio


def _get_user_id(app, email):
    from app.models.user import User
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        return user.id if user else None


@pytest.fixture
def alice_client(client):
    """Register Alice on the shared client. Returns client (logged in as Alice)."""
    _register_on(client, "Alice", "alice@example.com")
    return client


@pytest.fixture
def socket_alice(alice_client):
    """Socket.IO test client for Alice.

    Creates socket while client is logged in as Alice.
    Socket retains Alice's session cookie independently.
    """
    sio = _create_socket(alice_client, "alice@example.com")
    sio.user_id = _get_user_id(alice_client.application, "alice@example.com")
    return sio


@pytest.fixture
def socket_bob(client, socket_alice):
    """Socket.IO test client for Bob.

    Registers Bob on the shared client (CSRF token still valid from alice_client),
    creating Bob's session. Alice's socket (created earlier) retains her session.
    
    After this fixture, client is logged in as Bob.
    """
    _register_on(client, "Bob", "bob@example.com")
    sio = _create_socket(client, "bob@example.com")
    sio.user_id = _get_user_id(client.application, "bob@example.com")
    return sio


@pytest.fixture
def user_skills(alice_client, socket_bob):
    """Create Skill and UserSkill records for Alice and Bob.

    Both users exist in DB. The shared client is logged in as Bob
    (from socket_bob fixture). Uses alice_client.application for DB access.
    """
    from app.extensions import db
    from app.models.skill import Skill
    from app.models.user_skill import UserSkill
    from app.models.user import User

    app = alice_client.application
    with app.app_context():
        python = Skill(name="Python", category="Programming")
        react = Skill(name="React", category="Frontend")
        db.session.add_all([python, react])
        db.session.commit()

        alice = User.query.filter_by(email="alice@example.com").first()
        bob = User.query.filter_by(email="bob@example.com").first()

        alice_python = UserSkill(user_id=alice.id, skill_id=python.id, type="offered", proficiency="expert")
        alice_react = UserSkill(user_id=alice.id, skill_id=react.id, type="offered", proficiency="intermediate")
        bob_python = UserSkill(user_id=bob.id, skill_id=python.id, type="offered", proficiency="intermediate")
        bob_react = UserSkill(user_id=bob.id, skill_id=react.id, type="offered", proficiency="beginner")
        db.session.add_all([alice_python, alice_react, bob_python, bob_react])
        db.session.commit()

        return {
            "alice_python": alice_python.id,
            "alice_react": alice_react.id,
            "bob_python": bob_python.id,
            "bob_react": bob_react.id,
        }


@pytest.fixture
def sockets_bob_then_alice(client):
    """Bob connects first, then Alice. Returns (socket_alice, socket_bob).

    Used by presence tests: Bob's socket is ready to receive Alice's
    user_online event when Alice connects.
    """
    _register_on(client, "Bob", "bob@example.com")
    sio_bob = _create_socket(client, "bob@example.com")
    sio_bob.user_id = _get_user_id(client.application, "bob@example.com")

    _register_on(client, "Alice", "alice@example.com")
    sio_alice = _create_socket(client, "alice@example.com")
    sio_alice.user_id = _get_user_id(client.application, "alice@example.com")

    return sio_alice, sio_bob


@pytest.fixture
def alice_bob_swap(client, user_skills):
    """Create a pending swap request from Alice to Bob.

    Switches client back to Alice (it was Bob from socket_bob/user_skills),
    creates swap, returns swap_id. Client ends logged in as Alice.
    """
    from app.models.user import User
    with client.application.app_context():
        bob = User.query.filter_by(email="bob@example.com").first()
        bob_id = bob.id

    _login_as(client, "alice@example.com")
    resp = client.post("/api/swaps", json={
        "receiver_id": bob_id,
        "offered_skill_id": user_skills["alice_python"],
        "wanted_skill_id": user_skills["bob_react"],
    })
    assert resp.status_code == 201, f"Swap creation failed: {resp.get_json()}"
    return resp.get_json()["swap"]["id"]
