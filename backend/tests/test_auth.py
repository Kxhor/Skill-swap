import pytest


class TestRegister:
    def test_register_success(self, client):
        resp = client.post("/auth/register", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["user"]["name"] == "Alice"
        assert data["user"]["email"] == "alice@example.com"
        assert "id" in data["user"]

    def test_register_auto_login(self, client):
        client.post("/auth/register", json={
            "name": "Auto",
            "email": "auto@example.com",
            "password": "securepass123",
        })
        resp = client.get("/auth/me")
        assert resp.status_code == 200
        assert resp.get_json()["user"]["email"] == "auto@example.com"

    def test_register_duplicate_email(self, client):
        client.post("/auth/register", json={
            "name": "First",
            "email": "dup@example.com",
            "password": "securepass123",
        })
        resp = client.post("/auth/register", json={
            "name": "Second",
            "email": "dup@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 422
        assert "Validation failed" in resp.get_json()["error"]

    def test_register_missing_name(self, client):
        resp = client.post("/auth/register", json={
            "email": "noname@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 422

    def test_register_invalid_email(self, client):
        resp = client.post("/auth/register", json={
            "name": "Bad",
            "email": "not-an-email",
            "password": "securepass123",
        })
        assert resp.status_code == 422

    def test_register_short_password(self, client):
        resp = client.post("/auth/register", json={
            "name": "Weak",
            "email": "weak@example.com",
            "password": "12",
        })
        assert resp.status_code == 422

    def test_register_short_name(self, client):
        resp = client.post("/auth/register", json={
            "name": "A",
            "email": "short@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 422

    def test_register_empty_body(self, client):
        resp = client.post("/auth/register", json={})
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client):
        client.post("/auth/register", json={
            "name": "Bob", "email": "bob@example.com", "password": "securepass123",
        })
        client.post("/auth/logout")
        resp = client.post("/auth/login", json={
            "email": "bob@example.com", "password": "securepass123",
        })
        assert resp.status_code == 200
        assert resp.get_json()["user"]["name"] == "Bob"

    def test_login_wrong_password(self, client):
        client.post("/auth/register", json={
            "name": "Bob", "email": "bob@example.com", "password": "securepass123",
        })
        client.post("/auth/logout")
        resp = client.post("/auth/login", json={
            "email": "bob@example.com", "password": "wrongpass",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email(self, client):
        resp = client.post("/auth/login", json={
            "email": "noone@example.com", "password": "securepass123",
        })
        assert resp.status_code == 401

    def test_login_missing_credentials(self, client):
        resp = client.post("/auth/login", json={})
        assert resp.status_code == 422


class TestSession:
    def test_me_unauthenticated(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_authenticated(self, client):
        client.post("/auth/register", json={
            "name": "Session", "email": "session@example.com", "password": "securepass123",
        })
        resp = client.get("/auth/me")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["user"]["email"] == "session@example.com"

    def test_logout(self, client):
        client.post("/auth/register", json={
            "name": "Logout", "email": "logout@example.com", "password": "securepass123",
        })
        resp = client.post("/auth/logout")
        assert resp.status_code == 200
        assert client.get("/auth/me").status_code == 401

    def test_logout_unauthenticated(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code == 401

    def test_re_login(self, client):
        client.post("/auth/register", json={
            "name": "Relogin", "email": "relogin@example.com", "password": "securepass123",
        })
        client.post("/auth/logout")
        client.post("/auth/login", json={
            "email": "relogin@example.com", "password": "securepass123",
        })
        assert client.get("/auth/me").status_code == 200


class TestBannedUser:
    def test_banned_login_rejected(self, client):
        client.post("/auth/register", json={
            "name": "Banned", "email": "banned@example.com", "password": "securepass123",
        })
        from app.extensions import db
        from app.models.user import User
        user = User.query.filter_by(email="banned@example.com").first()
        user.is_banned = True
        db.session.commit()
        client.post("/auth/logout")

        resp = client.post("/auth/login", json={
            "email": "banned@example.com", "password": "securepass123",
        })
        assert resp.status_code == 403

    def test_mid_session_ban_invalidates(self, client):
        client.post("/auth/register", json={
            "name": "MidBan", "email": "midban@example.com", "password": "securepass123",
        })
        assert client.get("/auth/me").status_code == 200

        from app.extensions import db
        from app.models.user import User
        user = User.query.filter_by(email="midban@example.com").first()
        user.is_banned = True
        db.session.commit()

        assert client.get("/auth/me").status_code == 401

    def test_unban_allows_login(self, client):
        client.post("/auth/register", json={
            "name": "Unban", "email": "unban@example.com", "password": "securepass123",
        })
        from app.extensions import db
        from app.models.user import User
        user = User.query.filter_by(email="unban@example.com").first()
        user.is_banned = True
        db.session.commit()
        client.post("/auth/logout")

        user.is_banned = False
        db.session.commit()

        resp = client.post("/auth/login", json={
            "email": "unban@example.com", "password": "securepass123",
        })
        assert resp.status_code == 200


class TestAdminAuth:
    def test_admin_login_success(self, admin_client):
        resp = admin_client.get("/auth/me")
        assert resp.status_code == 200
        assert "admin" in resp.get_json()

    def test_admin_wrong_password(self, client):
        with client.application.app_context():
            from app.extensions import bcrypt
            from app.models.admin import Admin
            from app.extensions import db
            admin = Admin(
                email="admin2@test.com",
                password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
                role="admin",
            )
            db.session.add(admin)
            db.session.commit()

        resp = client.post("/auth/admin/login", json={
            "email": "admin2@test.com", "password": "wrong",
        })
        assert resp.status_code == 401

    def test_user_cannot_admin_login(self, client):
        client.post("/auth/register", json={
            "name": "User", "email": "user@example.com", "password": "securepass123",
        })
        resp = client.post("/auth/admin/login", json={
            "email": "user@example.com", "password": "securepass123",
        })
        assert resp.status_code == 401


class TestCSRF:
    def test_mutation_without_csrf_rejected(self, app):
        bare = app.test_client()
        resp = bare.post("/auth/register", json={
            "name": "Alice", "email": "alice@test.com", "password": "password123",
        })
        assert resp.status_code == 400
        assert "CSRF token" in resp.get_json()["error"]

    def test_mutation_with_valid_csrf_succeeds(self, client):
        """Uses the CSRF-aware client fixture."""
        resp = client.post("/auth/register", json={
            "name": "Alice", "email": "alice@test.com", "password": "password123",
        })
        assert resp.status_code == 201


class TestIsolation:
    def test_user_blocked_from_admin(self, client):
        client.post("/auth/register", json={
            "name": "User", "email": "iso@example.com", "password": "securepass123",
        })
        resp = client.get("/api/admin/stats")
        assert resp.status_code == 403

    def test_admin_blocked_from_user_routes(self, admin_client):
        resp = admin_client.get("/api/users/profile")
        assert resp.status_code == 403

        resp = admin_client.get("/api/swaps")
        assert resp.status_code == 403

        resp = admin_client.post("/api/feedback", json={})
        assert resp.status_code == 403
