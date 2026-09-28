"""Tests for admin endpoints in backend/app/routes/admin.py."""

import pytest
from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.models.user import User
from app.models.skill import Skill
from app.models.user_skill import UserSkill
from app.models.swap_request import SwapRequest
from app.models.feedback import Feedback


# ── Helper for creating test users ──────────────────────────────────────────

def _create_user(app, name, email, is_banned=False):
    with app.app_context():
        user = User(
            name=name,
            email=email,
            password_hash="mockhash",
            is_banned=is_banned,
        )
        db.session.add(user)
        db.session.commit()
        return user.id


def _create_skill(app, name, status="pending", category="General"):
    with app.app_context():
        skill = Skill(
            name=name,
            category=category,
            status=status,
        )
        db.session.add(skill)
        db.session.commit()
        return skill.id


# =========================================================================
# 1. Admin Stats
# =========================================================================

class TestAdminStats:
    def test_stats_keys_and_counts(self, admin_client):
        """Admin stats returns expected keys and reflects created fixture data."""
        app = admin_client.application
        with app.app_context():
            u1 = User(name="Active User", email="active@example.com", password_hash="hash", is_banned=False)
            u2 = User(name="Banned User", email="banned@example.com", password_hash="hash", is_banned=True)
            db.session.add_all([u1, u2])
            db.session.flush()

            s1 = Skill(name="ApprovedSkill", category="Tech", status="approved")
            s2 = Skill(name="PendingSkill", category="Music", status="pending")
            db.session.add_all([s1, s2])
            db.session.flush()

            us1 = UserSkill(user_id=u1.id, skill_id=s1.id, type="offered", proficiency="expert")
            us2 = UserSkill(user_id=u2.id, skill_id=s2.id, type="offered", proficiency="beginner")
            db.session.add_all([us1, us2])
            db.session.flush()

            sw1 = SwapRequest(
                sender_id=u1.id, receiver_id=u2.id,
                offered_skill_id=us1.id, wanted_skill_id=us2.id,
                status="pending",
            )
            sw2 = SwapRequest(
                sender_id=u2.id, receiver_id=u1.id,
                offered_skill_id=us2.id, wanted_skill_id=us1.id,
                status="completed",
            )
            db.session.add_all([sw1, sw2])
            db.session.flush()

            fb = Feedback(swap_id=sw2.id, rater_id=u1.id, rated_id=u2.id, rating=5, comment="Excellent swap!")
            db.session.add(fb)
            db.session.commit()

        resp = admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        data = resp.get_json()

        expected_keys = [
            "total_users", "active_users", "banned_users",
            "total_swaps", "pending_swaps", "active_swaps", "accepted_swaps", "completed_swaps",
            "total_skills", "pending_skills", "approved_skills",
            "new_users_week", "new_swaps_week", "average_rating",
        ]
        for key in expected_keys:
            assert key in data, f"Missing expected key '{key}' in stats response"

        assert data["total_users"] == 2
        assert data["active_users"] == 1
        assert data["banned_users"] == 1
        assert data["total_skills"] == 2
        assert data["approved_skills"] == 1
        assert data["pending_skills"] == 1
        assert data["total_swaps"] == 2
        assert data["pending_swaps"] == 1
        assert data["completed_swaps"] == 1
        assert data["average_rating"] == 5.0


# =========================================================================
# 2. User Management (list_users, ban, unban)
# =========================================================================

class TestAdminUsers:
    def test_list_users_pagination(self, admin_client):
        """list_users supports pagination arguments page and per_page."""
        app = admin_client.application
        for i in range(5):
            _create_user(app, f"User {i}", f"user{i}@example.com")

        resp = admin_client.get("/api/admin/users?page=1&per_page=2")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["page"] == 1
        assert data["total"] == 5
        assert data["pages"] == 3
        assert len(data["users"]) == 2

    def test_list_users_search_filter(self, admin_client):
        """list_users filters by search string on name or email."""
        app = admin_client.application
        _create_user(app, "Alice Anderson", "alice@example.com")
        _create_user(app, "Bob Brown", "bob@example.com")

        resp = admin_client.get("/api/admin/users?search=Alice")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 1
        assert data["users"][0]["name"] == "Alice Anderson"

    def test_list_users_status_filter(self, admin_client):
        """list_users filters by status: active, banned, or all."""
        app = admin_client.application
        _create_user(app, "Active User", "active@example.com", is_banned=False)
        _create_user(app, "Banned User", "banned@example.com", is_banned=True)

        resp_active = admin_client.get("/api/admin/users?status=active")
        assert resp_active.status_code == 200
        assert resp_active.get_json()["total"] == 1
        assert resp_active.get_json()["users"][0]["is_banned"] is False

        resp_banned = admin_client.get("/api/admin/users?status=banned")
        assert resp_banned.status_code == 200
        assert resp_banned.get_json()["total"] == 1
        assert resp_banned.get_json()["users"][0]["is_banned"] is True

        resp_all = admin_client.get("/api/admin/users?status=all")
        assert resp_all.status_code == 200
        assert resp_all.get_json()["total"] == 2

    def test_ban_and_unban_user_happy_path(self, admin_client):
        """Admin can ban an active user and unban a banned user."""
        app = admin_client.application
        uid = _create_user(app, "Target User", "target@example.com", is_banned=False)

        # Ban
        resp_ban = admin_client.post(f"/api/admin/users/{uid}/ban")
        assert resp_ban.status_code == 200
        assert "banned" in resp_ban.get_json()["message"]
        with app.app_context():
            assert User.query.get(uid).is_banned is True

        # Unban
        resp_unban = admin_client.post(f"/api/admin/users/{uid}/unban")
        assert resp_unban.status_code == 200
        assert "unbanned" in resp_unban.get_json()["message"]
        with app.app_context():
            assert User.query.get(uid).is_banned is False

    def test_ban_user_double_ban_conflict(self, admin_client):
        """Banning an already-banned user returns 409 conflict."""
        app = admin_client.application
        uid = _create_user(app, "Banned Already", "banned_already@example.com", is_banned=True)

        resp = admin_client.post(f"/api/admin/users/{uid}/ban")
        assert resp.status_code == 409
        assert resp.get_json()["error"] == "User is already banned"

    def test_unban_user_not_banned_conflict(self, admin_client):
        """Unbanning an active user returns 409 conflict."""
        app = admin_client.application
        uid = _create_user(app, "Active Already", "active_already@example.com", is_banned=False)

        resp = admin_client.post(f"/api/admin/users/{uid}/unban")
        assert resp.status_code == 409
        assert resp.get_json()["error"] == "User is not banned"

    def test_ban_unban_nonexistent_user_404(self, admin_client):
        """Banning or unbanning a missing user returns 404."""
        resp_ban = admin_client.post("/api/admin/users/nonexistent-id/ban")
        assert resp_ban.status_code == 404
        assert resp_ban.get_json()["error"] == "User not found"

        resp_unban = admin_client.post("/api/admin/users/nonexistent-id/unban")
        assert resp_unban.status_code == 404
        assert resp_unban.get_json()["error"] == "User not found"


# =========================================================================
# 3. Skill Moderation (list_skills, approve, reject)
# =========================================================================

class TestAdminSkills:
    def test_list_skills_pagination_search_filter(self, admin_client):
        """list_skills supports search, status filtering, and pagination."""
        app = admin_client.application
        _create_skill(app, "Python Programming", status="approved")
        _create_skill(app, "Guitar Playing", status="pending")
        _create_skill(app, "Pottery", status="rejected")

        # Search
        resp = admin_client.get("/api/admin/skills?search=Python")
        assert resp.status_code == 200
        assert resp.get_json()["total"] == 1
        assert resp.get_json()["skills"][0]["name"] == "Python Programming"

        # Status filter
        resp_pending = admin_client.get("/api/admin/skills?status=pending")
        assert resp_pending.status_code == 200
        assert resp_pending.get_json()["total"] == 1
        assert resp_pending.get_json()["skills"][0]["name"] == "Guitar Playing"

        # Pagination
        resp_page = admin_client.get("/api/admin/skills?page=1&per_page=2")
        assert resp_page.status_code == 200
        assert len(resp_page.get_json()["skills"]) == 2

    def test_approve_skill_happy_path(self, admin_client):
        """Approving a pending skill transitions status to approved."""
        app = admin_client.application
        sid = _create_skill(app, "Cooking", status="pending")

        resp = admin_client.post(f"/api/admin/skills/{sid}/approve")
        assert resp.status_code == 200
        assert "approved" in resp.get_json()["message"]
        with app.app_context():
            assert Skill.query.get(sid).status == "approved"

    def test_approve_skill_double_approve_conflict(self, admin_client):
        """Approving an already approved skill returns 409 conflict."""
        app = admin_client.application
        sid = _create_skill(app, "Drawing", status="approved")

        resp = admin_client.post(f"/api/admin/skills/{sid}/approve")
        assert resp.status_code == 409
        assert resp.get_json()["error"] == "Skill is already approved"

    def test_approve_skill_not_found_404(self, admin_client):
        """Approving a nonexistent skill returns 404."""
        resp = admin_client.post("/api/admin/skills/nonexistent-id/approve")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Skill not found"

    def test_reject_skill_happy_path(self, admin_client):
        """Rejecting a pending skill transitions status to rejected."""
        app = admin_client.application
        sid = _create_skill(app, "HarmfulSkill", status="pending")

        resp = admin_client.post(f"/api/admin/skills/{sid}/reject")
        assert resp.status_code == 200
        assert "rejected" in resp.get_json()["message"]
        with app.app_context():
            assert Skill.query.get(sid).status == "rejected"

    def test_reject_skill_double_reject_conflict(self, admin_client):
        """Rejecting an already rejected skill returns 409 conflict."""
        app = admin_client.application
        sid = _create_skill(app, "SpamSkill", status="rejected")

        resp = admin_client.post(f"/api/admin/skills/{sid}/reject")
        assert resp.status_code == 409
        assert resp.get_json()["error"] == "Skill is already rejected"

    def test_reject_skill_not_found_404(self, admin_client):
        """Rejecting a nonexistent skill returns 404."""
        resp = admin_client.post("/api/admin/skills/nonexistent-id/reject")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Skill not found"


# =========================================================================
# 4. Swap Oversight (list_swaps, delete_swap)
# =========================================================================

class TestAdminSwaps:
    def test_list_swaps_pagination_and_filter(self, admin_client):
        """list_swaps supports status filtering and pagination."""
        app = admin_client.application
        with app.app_context():
            u1 = User(name="User A", email="ua@example.com", password_hash="h")
            u2 = User(name="User B", email="ub@example.com", password_hash="h")
            s = Skill(name="S", status="approved")
            db.session.add_all([u1, u2, s])
            db.session.flush()

            us1 = UserSkill(user_id=u1.id, skill_id=s.id, type="offered")
            us2 = UserSkill(user_id=u2.id, skill_id=s.id, type="offered")
            db.session.add_all([us1, us2])
            db.session.flush()

            sw1 = SwapRequest(sender_id=u1.id, receiver_id=u2.id, offered_skill_id=us1.id, wanted_skill_id=us2.id, status="pending")
            sw2 = SwapRequest(sender_id=u2.id, receiver_id=u1.id, offered_skill_id=us2.id, wanted_skill_id=us1.id, status="accepted")
            db.session.add_all([sw1, sw2])
            db.session.commit()

        # Status filter
        resp_pending = admin_client.get("/api/admin/swaps?status=pending")
        assert resp_pending.status_code == 200
        data_p = resp_pending.get_json()
        assert data_p["total"] == 1
        assert data_p["swaps"][0]["status"] == "pending"

        # Pagination
        resp_paged = admin_client.get("/api/admin/swaps?page=1&per_page=1")
        assert resp_paged.status_code == 200
        assert len(resp_paged.get_json()["swaps"]) == 1

    def test_delete_swap_happy_path(self, admin_client):
        """Admin can delete a swap by ID."""
        app = admin_client.application
        with app.app_context():
            u1 = User(name="U1", email="u1_del@example.com", password_hash="h")
            u2 = User(name="U2", email="u2_del@example.com", password_hash="h")
            s = Skill(name="S_del", status="approved")
            db.session.add_all([u1, u2, s])
            db.session.flush()
            us1 = UserSkill(user_id=u1.id, skill_id=s.id, type="offered")
            us2 = UserSkill(user_id=u2.id, skill_id=s.id, type="offered")
            db.session.add_all([us1, us2])
            db.session.flush()
            sw = SwapRequest(sender_id=u1.id, receiver_id=u2.id, offered_skill_id=us1.id, wanted_skill_id=us2.id)
            db.session.add(sw)
            db.session.commit()
            swap_id = sw.id

        resp = admin_client.delete(f"/api/admin/swaps/{swap_id}")
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "Swap deleted"

        with app.app_context():
            assert SwapRequest.query.get(swap_id) is None

    def test_delete_swap_not_found_404(self, admin_client):
        """Deleting a nonexistent swap returns 404."""
        resp = admin_client.delete("/api/admin/swaps/nonexistent-id")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Swap not found"


# =========================================================================
# 5. Feedback Moderation (list_feedback, delete_feedback)
# =========================================================================

class TestAdminFeedback:
    def test_list_feedback(self, admin_client):
        """list_feedback returns feedback items with sender_name."""
        app = admin_client.application
        with app.app_context():
            u1 = User(name="Rater User", email="rater@example.com", password_hash="h")
            u2 = User(name="Rated User", email="rated@example.com", password_hash="h")
            s = Skill(name="Skill FB", status="approved")
            db.session.add_all([u1, u2, s])
            db.session.flush()
            us1 = UserSkill(user_id=u1.id, skill_id=s.id, type="offered")
            us2 = UserSkill(user_id=u2.id, skill_id=s.id, type="offered")
            db.session.add_all([us1, us2])
            db.session.flush()
            sw = SwapRequest(sender_id=u1.id, receiver_id=u2.id, offered_skill_id=us1.id, wanted_skill_id=us2.id, status="completed")
            db.session.add(sw)
            db.session.flush()
            fb = Feedback(swap_id=sw.id, rater_id=u1.id, rated_id=u2.id, rating=4, comment="Nice exchange")
            db.session.add(fb)
            db.session.commit()

        resp = admin_client.get("/api/admin/feedback")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 1
        assert data["feedback"][0]["comment"] == "Nice exchange"
        assert data["feedback"][0]["sender_name"] == "Rater User"

    def test_delete_feedback_happy_path(self, admin_client):
        """Admin can delete feedback by ID."""
        app = admin_client.application
        with app.app_context():
            u1 = User(name="Rater", email="rater_del@example.com", password_hash="h")
            u2 = User(name="Rated", email="rated_del@example.com", password_hash="h")
            s = Skill(name="Skill FB Del", status="approved")
            db.session.add_all([u1, u2, s])
            db.session.flush()
            us1 = UserSkill(user_id=u1.id, skill_id=s.id, type="offered")
            us2 = UserSkill(user_id=u2.id, skill_id=s.id, type="offered")
            db.session.add_all([us1, us2])
            db.session.flush()
            sw = SwapRequest(sender_id=u1.id, receiver_id=u2.id, offered_skill_id=us1.id, wanted_skill_id=us2.id, status="completed")
            db.session.add(sw)
            db.session.flush()
            fb = Feedback(swap_id=sw.id, rater_id=u1.id, rated_id=u2.id, rating=1, comment="Spam feedback")
            db.session.add(fb)
            db.session.commit()
            fb_id = fb.id

        resp = admin_client.delete(f"/api/admin/feedback/{fb_id}")
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "Feedback deleted"

        with app.app_context():
            assert Feedback.query.get(fb_id) is None

    def test_delete_feedback_not_found_404(self, admin_client):
        """Deleting nonexistent feedback returns 404."""
        resp = admin_client.delete("/api/admin/feedback/nonexistent-id")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Feedback not found"


# =========================================================================
# 6. Announcements
# =========================================================================

class TestAdminAnnouncements:
    def test_send_announcement_missing_fields_422(self, admin_client):
        """Missing title or message returns 422 validation error."""
        # Empty body
        resp = admin_client.post("/api/admin/announcements", json={})
        assert resp.status_code == 422
        assert "Title and message are required" in resp.get_json()["error"]

        # Only title
        resp = admin_client.post("/api/admin/announcements", json={"title": "Notice"})
        assert resp.status_code == 422

        # Only message
        resp = admin_client.post("/api/admin/announcements", json={"message": "Content"})
        assert resp.status_code == 422

    def test_send_announcement_valid(self, admin_client):
        """Valid announcement payload returns 200 and broadcasts."""
        payload = {
            "title": "Platform Upgrade",
            "message": "We are upgrading the servers at midnight.",
            "type": "warning",
        }
        resp = admin_client.post("/api/admin/announcements", json=payload)
        assert resp.status_code == 200
        assert "Platform Upgrade" in resp.get_json()["message"]


# =========================================================================
# 7. Recent Activity
# =========================================================================

class TestAdminActivity:
    def test_recent_activity_shape_and_ordering(self, admin_client):
        """Recent activity returns sorted user and swap events."""
        app = admin_client.application
        with app.app_context():
            u1 = User(name="Activity User 1", email="act1@example.com", password_hash="h")
            u2 = User(name="Activity User 2", email="act2@example.com", password_hash="h")
            s = Skill(name="Act Skill", status="approved")
            db.session.add_all([u1, u2, s])
            db.session.flush()
            us1 = UserSkill(user_id=u1.id, skill_id=s.id, type="offered")
            us2 = UserSkill(user_id=u2.id, skill_id=s.id, type="offered")
            db.session.add_all([us1, us2])
            db.session.flush()
            sw = SwapRequest(sender_id=u1.id, receiver_id=u2.id, offered_skill_id=us1.id, wanted_skill_id=us2.id, status="pending")
            db.session.add(sw)
            db.session.commit()

        resp = admin_client.get("/api/admin/activity?limit=10")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "activity" in data
        assert len(data["activity"]) >= 2
        for item in data["activity"]:
            assert "type" in item
            assert "data" in item
            assert "timestamp" in item


# =========================================================================
# 8. Role Isolation & Boundary Guards
# =========================================================================

class TestAdminIsolationBoundary:
    def test_regular_user_blocked_from_all_admin_routes(self, logged_in_client):
        """Regular authenticated user receives 403 on all admin endpoints."""
        endpoints = [
            ("GET", "/api/admin/stats", None),
            ("GET", "/api/admin/users", None),
            ("POST", "/api/admin/users/fake-id/ban", {}),
            ("POST", "/api/admin/users/fake-id/unban", {}),
            ("GET", "/api/admin/skills", None),
            ("POST", "/api/admin/skills/fake-id/approve", {}),
            ("POST", "/api/admin/skills/fake-id/reject", {}),
            ("GET", "/api/admin/swaps", None),
            ("DELETE", "/api/admin/swaps/fake-id", None),
            ("GET", "/api/admin/feedback", None),
            ("DELETE", "/api/admin/feedback/fake-id", None),
            ("POST", "/api/admin/announcements", {"title": "X", "message": "Y"}),
            ("GET", "/api/admin/activity", None),
        ]

        for method, path, json_data in endpoints:
            if method == "GET":
                resp = logged_in_client.get(path)
            elif method == "POST":
                resp = logged_in_client.post(path, json=json_data)
            elif method == "DELETE":
                resp = logged_in_client.delete(path)
            assert resp.status_code == 403, f"Expected 403 on {method} {path}, got {resp.status_code}"
            assert resp.get_json()["error"] == "Admin access required"

    def test_admin_blocked_from_users_bp(self, admin_client):
        """Admin session receives 403 from users_bp routes."""
        resp = admin_client.get("/api/users")
        assert resp.status_code == 403
        assert resp.get_json()["error"] == "Admin accounts cannot access user endpoints"

    def test_regular_user_allowed_on_users_bp(self, logged_in_client):
        """Regular user session is allowed (200) on GET /api/users."""
        resp = logged_in_client.get("/api/users")
        assert resp.status_code == 200
        assert "users" in resp.get_json()
