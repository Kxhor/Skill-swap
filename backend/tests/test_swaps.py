import pytest


@pytest.fixture
def two_users(client):
    """Register two users. User A is logged in after fixture."""
    # User A (Alice) - logs in by default
    client.post("/auth/register", json={
        "name": "Alice", "email": "alice@test.com", "password": "password123",
    })
    # Add Alice's offered skill
    resp = client.post("/api/users/skills", json={
        "skill_name": "Python", "type": "offered", "proficiency": "expert",
    })
    alice_python = resp.get_json()["skill"]
    # Add Alice's wanted skill
    resp = client.post("/api/users/skills", json={
        "skill_name": "Web Dev", "type": "wanted", "proficiency": "beginner",
    })
    alice_webdev_wanted = resp.get_json()["skill"]
    client.post("/auth/logout")

    # User B (Bob)
    client.post("/auth/register", json={
        "name": "Bob", "email": "bob@test.com", "password": "password123",
    })
    # Add Bob's offered skill
    resp = client.post("/api/users/skills", json={
        "skill_name": "Web Dev", "type": "offered", "proficiency": "expert",
    })
    bob_webdev = resp.get_json()["skill"]
    # Add Bob's wanted skill
    resp = client.post("/api/users/skills", json={
        "skill_name": "Python", "type": "wanted", "proficiency": "beginner",
    })
    bob_python_wanted = resp.get_json()["skill"]

    return {
        "client": client,
        "alice_python": alice_python,
        "alice_wanted": alice_webdev_wanted,
        "bob_webdev": bob_webdev,
        "bob_wanted": bob_python_wanted,
    }


@pytest.fixture
def alice_id(client, two_users):
    """Get Alice's user ID."""
    resp = client.get("/api/users")
    for u in resp.get_json()["users"]:
        if u["name"] == "Alice":
            return u["id"]
    return None


class TestSwapLifecycle:
    def test_create_swap(self, client, two_users, alice_id):
        """Bob (logged in) sends a swap request to Alice."""
        two_users  # Bob is logged in
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["swap"]["status"] == "pending"
        assert data["swap"]["sender_id"] is not None
        assert data["swap"]["receiver_id"] == alice_id

    def test_create_swap_invalid_receiver_skill(self, client, two_users, alice_id):
        """Bob sends swap with a skill Alice doesn't own."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["bob_webdev"]["id"],  # Bob's own skill, not Alice's
        })
        assert resp.status_code == 422

    def test_create_swap_self(self, client, two_users):
        """Cannot swap with yourself."""
        two_users
        me = client.get("/auth/me").get_json()["user"]
        resp = client.post("/api/swaps", json={
            "receiver_id": me["id"],
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        assert resp.status_code == 422  # cannot swap with yourself

    def test_accept_swap(self, client, two_users, alice_id):
        """Full accept flow: Bob sends, Alice logs in and accepts."""
        two_users  # Bob logged in
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        # Alice logs in
        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        resp = client.post(f"/api/swaps/{swap_id}/accept")
        assert resp.status_code == 200
        assert resp.get_json()["swap"]["status"] == "accepted"

    def test_reject_swap(self, client, two_users, alice_id):
        """Full reject flow."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        resp = client.post(f"/api/swaps/{swap_id}/reject")
        assert resp.status_code == 200
        assert resp.get_json()["swap"]["status"] == "rejected"

    def test_cancel_swap(self, client, two_users, alice_id):
        """Sender (Bob) cancels a pending swap."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]

        resp = client.post(f"/api/swaps/{swap_id}/cancel")
        assert resp.status_code == 200
        assert resp.get_json()["swap"]["status"] == "cancelled"

    def test_complete_swap(self, client, two_users, alice_id):
        """Full complete flow: Bob sends, Alice accepts, Bob completes."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/accept")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        resp = client.post(f"/api/swaps/{swap_id}/complete")
        assert resp.status_code == 200
        assert resp.get_json()["swap"]["status"] == "completed"

    def test_swap_list_tabs(self, client, two_users, alice_id):
        """Test listing swaps by tab."""
        two_users
        # Create a swap
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]

        resp = client.get("/api/swaps?tab=pending")
        assert resp.status_code == 200
        assert resp.get_json()["total"] >= 1

        resp = client.get("/api/swaps?tab=all")
        assert resp.status_code == 200


class TestChatMessages:
    def test_send_and_get_messages(self, client, two_users, alice_id):
        """Send a message in an accepted swap and retrieve it."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/accept")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        resp = client.post(f"/api/swaps/{swap_id}/messages", json={
            "content": "Hey Alice, ready to swap?",
        })
        assert resp.status_code == 201
        assert resp.get_json()["message"]["content"] == "Hey Alice, ready to swap?"

        resp = client.get(f"/api/swaps/{swap_id}/messages")
        assert resp.status_code == 200
        messages = resp.get_json()["messages"]
        assert len(messages) >= 2  # system message + user message
        assert messages[-1]["content"] == "Hey Alice, ready to swap?"

    def test_empty_message_rejected(self, client, two_users, alice_id):
        """Empty message returns 422."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/accept")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        resp = client.post(f"/api/swaps/{swap_id}/messages", json={
            "content": "",
        })
        assert resp.status_code == 422


class TestFeedback:
    def test_submit_feedback(self, client, two_users, alice_id):
        """Submit feedback after a completed swap."""
        # Bob sends, Alice accepts, Bob completes
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/accept")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/complete")
        client.post("/auth/logout")

        # Bob provides feedback for Alice
        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        resp = client.post("/api/feedback", json={
            "swap_id": swap_id,
            "rating": 5,
            "comment": "Great swap!",
        })
        assert resp.status_code == 201
        assert resp.get_json()["feedback"]["rating"] == 5

    def test_duplicate_feedback_rejected(self, client, two_users, alice_id):
        """Cannot submit feedback twice for same swap."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/accept")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/complete")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        client.post("/api/feedback", json={
            "swap_id": swap_id, "rating": 5, "comment": "Great!",
        })
        resp = client.post("/api/feedback", json={
            "swap_id": swap_id, "rating": 4, "comment": "Duplicate",
        })
        assert resp.status_code == 409

    def test_feedback_on_non_completed_swap(self, client, two_users, alice_id):
        """Cannot submit feedback on a non-completed swap."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]

        resp = client.post("/api/feedback", json={
            "swap_id": swap_id, "rating": 5,
        })
        assert resp.status_code == 422  # not completed

    def test_get_user_feedback(self, client, two_users, alice_id):
        """Retrieve feedback for a user."""
        two_users
        resp = client.post("/api/swaps", json={
            "receiver_id": alice_id,
            "offered_skill_id": two_users["bob_webdev"]["id"],
            "wanted_skill_id": two_users["alice_python"]["id"],
        })
        swap_id = resp.get_json()["swap"]["id"]
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "alice@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/accept")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        client.post(f"/api/swaps/{swap_id}/complete")
        client.post("/auth/logout")

        client.post("/auth/login", json={
            "email": "bob@test.com", "password": "password123",
        })
        client.post("/api/feedback", json={
            "swap_id": swap_id, "rating": 4, "comment": "Good swap!",
        })

        resp = client.get(f"/api/feedback/user/{alice_id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["average_rating"] == 4.0
        assert data["rating_count"] == 1
