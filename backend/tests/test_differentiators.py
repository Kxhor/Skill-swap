"""Tests for Session 5 features: AI match scoring, verified badges, session scheduling."""

import pytest
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.models.user import User
from app.models.skill import Skill
from app.models.user_skill import UserSkill
from app.models.swap_request import SwapRequest
from app.models.match_score import MatchScore
from app.models.verified_badge import VerifiedBadge
from app.models.scheduled_session import ScheduledSession


# ── Helpers ──────────────────────────────────────────────────────────────

def _register(client, name, email):
    client.post("/auth/register", json={"name": name, "email": email, "password": "password123"})


def _login(client, email):
    client.post("/auth/login", json={"email": email, "password": "password123"})


def _add_skill(client, name, typ):
    return client.post("/api/users/skills", json={"skill_name": name, "type": typ, "proficiency": "intermediate"}).get_json()["skill"]["id"]


def _create_swap(client, receiver_id, offered_id, wanted_id):
    r = client.post("/api/swaps", json={
        "receiver_id": receiver_id, "offered_skill_id": offered_id, "wanted_skill_id": wanted_id,
    })
    assert r.status_code == 201, f"Swap failed: {r.get_json()}"
    return r.get_json()["swap"]["id"]


def _accept_swap(client, swap_id):
    r = client.post(f"/api/swaps/{swap_id}/accept")
    assert r.status_code == 200, f"Accept failed: {r.get_json()}"


def _complete_swap(client, swap_id):
    r = client.post(f"/api/swaps/{swap_id}/complete")
    assert r.status_code == 200, f"Complete failed: {r.get_json()}"


def _feedback(client, swap_id, rating):
    r = client.post("/api/feedback", json={"swap_id": swap_id, "rating": rating, "comment": "Great swap!"})
    return r


def _complete_cycle_as_alice(client, bob_id, a_off, b_off):
    """Alice creates a swap, Bob accepts, Alice completes, Bob rates (rating param). Returns swap_id."""
    _login(client, "alice_diff@test.com")
    sid = _create_swap(client, bob_id, a_off, b_off)
    _login(client, "bob_diff@test.com")
    _accept_swap(client, sid)
    _login(client, "alice_diff@test.com")
    _complete_swap(client, sid)
    _login(client, "bob_diff@test.com")
    return sid


# ── Fixture: two users on one shared client ─────────────────────────────

@pytest.fixture
def two_users(client):
    """Register Alice & Bob on a single client. Returns (alice_id, bob_id, a_offered, b_offered)."""
    _register(client, "Alice", "alice_diff@test.com")
    alice_id = client.get("/auth/me").get_json()["user"]["id"]
    a_offered = _add_skill(client, "Python", "offered")
    _add_skill(client, "Guitar", "wanted")

    client.post("/auth/logout")
    _register(client, "Bob", "bob_diff@test.com")
    bob_id = client.get("/auth/me").get_json()["user"]["id"]
    b_offered = _add_skill(client, "Guitar", "offered")
    _add_skill(client, "Python", "wanted")

    return alice_id, bob_id, a_offered, b_offered


# =========================================================================
# 1. AI Match Scoring
# =========================================================================

class TestMatchScore:
    def _as_alice(self, client, two_users):
        _login(client, "alice_diff@test.com")
        return two_users  # (alice_id, bob_id, a_off, b_off)

    def test_match_requires_login(self, client):
        assert client.get("/api/users/match/some-id").status_code == 401

    def test_match_with_self_rejected(self, client, two_users):
        alice_id, _, _, _ = self._as_alice(client, two_users)
        r = client.get(f"/api/users/match/{alice_id}")
        assert r.status_code == 422
        assert "yourself" in r.get_json()["error"]

    def test_match_nonexistent_user_404(self, client, two_users):
        self._as_alice(client, two_users)
        assert client.get("/api/users/match/does-not-exist").status_code == 404

    def test_match_no_skills_returns_zero(self, client, two_users):
        _register(client, "NoSkillA", "noskilla@test.com")
        a_id = client.get("/auth/me").get_json()["user"]["id"]
        _register(client, "NoSkillB", "noskillb@test.com")
        b_id = client.get("/auth/me").get_json()["user"]["id"]
        _login(client, "noskilla@test.com")
        r = client.get(f"/api/users/match/{b_id}")
        assert r.status_code == 200
        data = r.get_json()
        assert data["score"] == 0
        assert "Not enough skill data" in data["reason"]

    @patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"})
    @patch("google.generativeai.GenerativeModel")
    def test_match_with_skills_computes_score(self, mock_GM, client, two_users):
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = '{"score": 85, "reason": "Great match!"}'
        mock_GM.return_value = mock_model

        _, bob_id, _, _ = self._as_alice(client, two_users)
        r = client.get(f"/api/users/match/{bob_id}")
        assert r.status_code == 200
        data = r.get_json()
        assert data["score"] == 85
        assert data["cached"] is False

    @patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"})
    @patch("google.generativeai.GenerativeModel")
    def test_match_cache_returns_cached_on_second_call(self, mock_GM, client, two_users):
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = '{"score": 72, "reason": "Good match!"}'
        mock_GM.return_value = mock_model

        _, bob_id, _, _ = self._as_alice(client, two_users)
        client.get(f"/api/users/match/{bob_id}")
        r = client.get(f"/api/users/match/{bob_id}")
        assert r.get_json()["cached"] is True

    @patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"})
    @patch("google.generativeai.GenerativeModel")
    def test_match_cache_expires_after_7_days(self, mock_GM, client, two_users, app):
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = '{"score": 60, "reason": "OK match"}'
        mock_GM.return_value = mock_model

        _, bob_id, _, _ = self._as_alice(client, two_users)
        client.get(f"/api/users/match/{bob_id}")

        with app.app_context():
            ms = MatchScore.query.first()
            ms.computed_at = datetime.now(timezone.utc) - timedelta(days=8)
            db.session.commit()

        mock_model.generate_content.return_value.text = '{"score": 90, "reason": "Better match now!"}'
        r = client.get(f"/api/users/match/{bob_id}")
        assert r.get_json()["cached"] is False
        assert r.get_json()["score"] == 90

    @patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"})
    @patch("google.generativeai.GenerativeModel")
    def test_match_works_both_directions(self, mock_GM, client, two_users):
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = '{"score": 80, "reason": "Reciprocal!"}'
        mock_GM.return_value = mock_model

        alice_id, bob_id, _, _ = self._as_alice(client, two_users)
        client.get(f"/api/users/match/{bob_id}")  # A→B caches

        _login(client, "bob_diff@test.com")
        r = client.get(f"/api/users/match/{alice_id}")  # B→A hits cache
        assert r.get_json()["cached"] is True

    @patch.dict("os.environ", {"GEMINI_API_KEY": ""})
    def test_missing_api_key_falls_back(self, client, two_users):
        _, bob_id, _, _ = self._as_alice(client, two_users)
        r = client.get(f"/api/users/match/{bob_id}")
        assert r.status_code == 200
        assert r.get_json()["score"] == 50
        assert "no api key" in r.get_json()["reason"].lower()

    @patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"})
    @patch("google.generativeai.GenerativeModel")
    def test_invalid_json_response_handled(self, mock_GM, client, two_users):
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = "not json at all"
        mock_GM.return_value = mock_model

        _, bob_id, _, _ = self._as_alice(client, two_users)
        assert isinstance(client.get(f"/api/users/match/{bob_id}").get_json()["score"], int)

    @patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"})
    @patch("google.generativeai.GenerativeModel")
    def test_malformed_json_with_regex_fallback(self, mock_GM, client, two_users):
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = 'Some text {"score": 45, "reason": "Partial match"} trailing'
        mock_GM.return_value = mock_model

        _, bob_id, _, _ = self._as_alice(client, two_users)
        assert client.get(f"/api/users/match/{bob_id}").get_json()["score"] == 45


# =========================================================================
# 2. Verified Badges
# =========================================================================

class TestVerifiedBadges:
    def test_no_badge_before_threshold(self, client, two_users, app):
        _, bob_id, a_off, b_off = two_users
        sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
        _feedback(client, sid, 3)
        with app.app_context():
            assert VerifiedBadge.query.count() == 0

    def test_badge_awarded_after_three_qualifying(self, client, two_users, app):
        _, bob_id, a_off, b_off = two_users
        for i in range(3):
            sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
            _feedback(client, sid, 5)
        with app.app_context():
            assert VerifiedBadge.query.count() >= 1

    def test_duplicate_badge_not_created(self, client, two_users, app):
        _, bob_id, a_off, b_off = two_users
        for i in range(3):
            sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
            _feedback(client, sid, 5)
        with app.app_context():
            count = VerifiedBadge.query.count()
        sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
        _feedback(client, sid, 5)
        with app.app_context():
            assert VerifiedBadge.query.count() == count

    def test_badge_included_in_profile_response(self, client, two_users, app):
        alice_id, bob_id, a_off, b_off = two_users
        for i in range(3):
            sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
            _feedback(client, sid, 5)
        _login(client, "bob_diff@test.com")
        r = client.get(f"/api/users/{alice_id}")
        offered = r.get_json()["user"].get("skills_offered", [])
        assert any(s.get("verified_badge") is not None for s in offered)

    def test_low_rating_does_not_award_badge(self, client, two_users, app):
        _, bob_id, a_off, b_off = two_users
        for i in range(3):
            sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
            _feedback(client, sid, 2)
        with app.app_context():
            assert VerifiedBadge.query.count() == 0


# =========================================================================
# 3. Session Scheduling
# =========================================================================

class TestSessionScheduling:
    def test_schedule_only_accepted(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": future})
        assert r.status_code == 422 and "accepted" in r.get_json()["error"]

    def test_schedule_rejected_swap_blocked(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        _login(client, "bob_diff@test.com")
        client.post(f"/api/swaps/{sid}/reject")
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        _login(client, "alice_diff@test.com")
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": future})
        assert r.status_code == 422 and "accepted" in r.get_json()["error"]

    def _accept_as_bob(self, client, sid):
        _login(client, "bob_diff@test.com")
        _accept_swap(client, sid)

    def _accept_and_schedule_as_alice(self, client, bob_id, a_off, b_off, future):
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        self._accept_as_bob(client, sid)
        _login(client, "alice_diff@test.com")
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": future})
        return sid, r

    def test_propose_and_get_session(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        sid, r = self._accept_and_schedule_as_alice(client, bob_id, a_off, b_off, future)
        assert r.status_code == 201
        s = r.get_json()["session"]
        assert s["status"] == "proposed"
        assert "calendar.google.com" in s["calendar_link"]
        assert client.get(f"/api/swaps/{sid}/schedule").get_json()["session"]["id"] == s["id"]

    def test_proposer_cannot_confirm(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        sid, _ = self._accept_and_schedule_as_alice(client, bob_id, a_off, b_off, future)
        r = client.post(f"/api/swaps/{sid}/schedule/confirm")
        assert r.status_code == 422 and "your own proposal" in r.get_json()["error"]

    def test_other_participant_can_confirm(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        sid, _ = self._accept_and_schedule_as_alice(client, bob_id, a_off, b_off, future)
        _login(client, "bob_diff@test.com")
        r = client.post(f"/api/swaps/{sid}/schedule/confirm")
        assert r.status_code == 200 and r.get_json()["session"]["status"] == "confirmed"

    def test_duplicate_proposal_rejected(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        sid, _ = self._accept_and_schedule_as_alice(client, bob_id, a_off, b_off, future)
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": future})
        assert r.status_code == 409 and "already scheduled" in r.get_json()["error"]

    def test_past_date_rejected(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        self._accept_as_bob(client, sid)
        _login(client, "alice_diff@test.com")
        past = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": past})
        assert r.status_code == 422 and "future" in r.get_json()["error"].lower()

    def test_invalid_date_format_rejected(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        self._accept_as_bob(client, sid)
        _login(client, "alice_diff@test.com")
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": "not-a-date"})
        assert r.status_code == 422 and "Invalid datetime" in r.get_json()["error"]

    def test_missing_date_rejected(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        self._accept_as_bob(client, sid)
        _login(client, "alice_diff@test.com")
        r = client.post(f"/api/swaps/{sid}/schedule", json={})
        assert r.status_code == 422 and "required" in r.get_json()["error"]

    def test_get_session_without_schedule_returns_null(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        self._accept_as_bob(client, sid)
        _login(client, "alice_diff@test.com")
        assert client.get(f"/api/swaps/{sid}/schedule").get_json()["session"] is None

    def test_unauthorized_user_cannot_access(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        self._accept_as_bob(client, sid)
        _login(client, "alice_diff@test.com")
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": future})
        client.post("/auth/logout")
        assert client.get(f"/api/swaps/{sid}/schedule").status_code == 401


# =========================================================================
# 4. Edge Cases
# =========================================================================

class TestEdgeCases:
    def test_deleted_user_match_returns_404(self, client, two_users, app):
        alice_id, bob_id, _, _ = two_users
        _login(client, "alice_diff@test.com")
        with app.app_context():
            User.query.filter_by(id=bob_id).delete()
            db.session.commit()
        r = client.get(f"/api/users/match/{bob_id}")
        assert r.status_code == 404

    def test_schedule_deleted_swap_404(self, client, two_users, app):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        with app.app_context():
            SwapRequest.query.filter_by(id=sid).delete()
            db.session.commit()
        assert client.get(f"/api/swaps/{sid}/schedule").status_code == 404

    def test_match_banned_user_404(self, client, two_users, app):
        alice_id, bob_id, _, _ = two_users
        _login(client, "alice_diff@test.com")
        with app.app_context():
            u = User.query.get(bob_id)
            u.is_banned = True
            db.session.commit()
        r = client.get(f"/api/users/match/{bob_id}")
        assert r.status_code == 404

    def test_community_stats_empty(self, client):
        r = client.get("/api/users/stats/community")
        assert r.status_code == 200
        data = r.get_json()
        assert data["total_users"] == 0
        assert data["total_swaps"] == 0
        assert data["skill_summary"] == []

    def test_verified_badge_included_in_skill_listing(self, client, two_users, app):
        alice_id, bob_id, a_off, b_off = two_users
        for i in range(3):
            sid = _complete_cycle_as_alice(client, bob_id, a_off, b_off)
            _feedback(client, sid, 5)
        _login(client, "alice_diff@test.com")
        r = client.get(f"/api/users/{alice_id}")
        s = r.get_json()["user"]["skills_offered"][0]
        assert "verified_badge" in s
        assert "is_verified" in s
        if s["verified_badge"]:
            assert "id" in s["verified_badge"]
            assert "verified_at" in s["verified_badge"]
            assert "verification_count" in s["verified_badge"]


# =========================================================================
# 5. Calendar link
# =========================================================================

class TestCalendarLink:
    def test_calendar_link_shape(self, client, two_users):
        _, bob_id, a_off, b_off = two_users
        _login(client, "alice_diff@test.com")
        sid = _create_swap(client, bob_id, a_off, b_off)
        _login(client, "bob_diff@test.com")
        _accept_swap(client, sid)
        _login(client, "alice_diff@test.com")
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        r = client.post(f"/api/swaps/{sid}/schedule", json={"scheduled_at": future})
        assert r.status_code == 201
        assert r.get_json()["session"]["calendar_link"].startswith("https://calendar.google.com/calendar/render")
