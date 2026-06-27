"""Tests for Socket.IO connection handlers and event routing."""


def _as(flask_client, email, password="password123"):
    """Switch the shared test client to act as the given user."""
    resp = flask_client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code in (200, 201), f"Login as {email} failed: {resp.get_json()}"


class TestSocketConnection:
    """6a: Socket.IO connection/disconnection with auth."""

    def test_connect_authenticated(self, socket_alice):
        """Authenticated user can connect."""
        assert socket_alice.is_connected()

    def test_connect_rejects_anonymous(self, app):
        """Anonymous connection is rejected."""
        from app.extensions import socketio
        sio = socketio.test_client(app, namespace="/")
        assert not sio.is_connected()

    def test_disconnect_graceful(self, socket_alice):
        """Disconnecting does not raise."""
        socket_alice.disconnect()
        assert not socket_alice.is_connected()

    def test_join_user_room_auto(self, socket_alice):
        """Client automatically joins their user_{id} room on connect."""
        from app.extensions import socketio
        alice_id = socket_alice.user_id
        socketio.emit("test_echo", {"payload": "room"}, room=f"user_{alice_id}")
        received = socket_alice.get_received("/")
        test_events = [e for e in received if e["name"] == "test_echo"]
        assert len(test_events) == 1
        assert test_events[0]["args"][0]["payload"] == "room"

    def test_user_not_in_others_room(self, socket_alice, socket_bob):
        """Alice does not receive events sent to Bob's room."""
        from app.extensions import socketio
        bob_id = socket_bob.user_id
        socketio.emit("test_private", {"msg": "for bob"}, room=f"user_{bob_id}")
        alice_received = socket_alice.get_received("/")
        assert not any(e["name"] == "test_private" for e in alice_received)

    def test_broadcast_received(self, socket_alice):
        """Global broadcast events reach all connected clients."""
        from app.extensions import socketio
        socketio.emit("admin_broadcast", {"title": "Test", "message": "All", "type": "info"})
        received = socket_alice.get_received("/")
        events = [e for e in received if e["name"] == "admin_broadcast"]
        assert len(events) == 1
        assert events[0]["args"][0]["title"] == "Test"

    def test_connect_after_reconnect(self, socket_alice, alice_client):
        """Client can disconnect and reconnect."""
        socket_alice.disconnect()
        assert not socket_alice.is_connected()
        socket_alice.connect()
        assert socket_alice.is_connected()

    def test_cannot_join_others_user_room(self, socket_alice, client):
        """Third user cannot join another user's room via join event."""
        from app.extensions import socketio
        from app.models.user import User

        resp = client.post("/auth/register", json={
            "name": "Eve", "email": "eve@example.com", "password": "password123",
        })
        assert resp.status_code == 201

        app = client.application
        sio_eve = socketio.test_client(app, flask_test_client=client)
        assert sio_eve.is_connected()
        with app.app_context():
            user = User.query.filter_by(email="eve@example.com").first()
            sio_eve.user_id = user.id
        sio_eve.app = app

        alice_id = socket_alice.user_id
        sio_eve.emit("join", {"room": f"user_{alice_id}"})

        socketio.emit("test_secret", {"msg": "leaked!"}, room=f"user_{alice_id}")
        eve_received = sio_eve.get_received("/")
        assert not any(e["name"] == "test_secret" for e in eve_received)


class TestSocketSwapRooms:
    """6a: Room-based event delivery for swap lifecycle."""

    def test_receiver_gets_new_swap_event(self, socket_alice, client, user_skills):
        """Bob's swap creation emits new_swap_request to Alice's room."""
        from app.models.user import User
        with client.application.app_context():
            alice = User.query.filter_by(email="alice@example.com").first()

        _as(client, "bob@example.com")
        resp = client.post("/api/swaps", json={
            "receiver_id": alice.id,
            "offered_skill_id": user_skills["bob_python"],
            "wanted_skill_id": user_skills["alice_react"],
        })
        assert resp.status_code == 201

        received = socket_alice.get_received("/")
        events = [e for e in received if e["name"] == "new_swap_request"]
        assert len(events) == 1
        assert events[0]["args"][0]["swap"]["id"] == resp.get_json()["swap"]["id"]

    def test_sender_gets_accepted_event(self, socket_alice, socket_bob, alice_bob_swap, client):
        """When Bob accepts, Alice receives swap_accepted."""
        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        resp = client.post(f"/api/swaps/{swap_id}/accept", json={})
        assert resp.status_code == 200

        alice_received = socket_alice.get_received("/")
        events = [e for e in alice_received if e["name"] == "swap_accepted"]
        assert len(events) == 1
        assert events[0]["args"][0]["swap"]["id"] == swap_id

    def test_sender_gets_rejected_event(self, socket_alice, socket_bob, alice_bob_swap, client):
        """When Bob rejects, Alice receives swap_rejected."""
        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        resp = client.post(f"/api/swaps/{swap_id}/reject", json={})
        assert resp.status_code == 200

        alice_received = socket_alice.get_received("/")
        events = [e for e in alice_received if e["name"] == "swap_rejected"]
        assert len(events) == 1
        assert events[0]["args"][0]["swap"]["id"] == swap_id

    def test_both_receive_accepted_event(self, socket_alice, socket_bob, alice_bob_swap, client):
        """Both sender and receiver get swap_accepted event."""
        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        resp = client.post(f"/api/swaps/{swap_id}/accept", json={})
        assert resp.status_code == 200

        alice_received = socket_alice.get_received("/")
        bob_received = socket_bob.get_received("/")
        assert any(e["name"] == "swap_accepted" for e in alice_received)
        assert any(e["name"] == "swap_accepted" for e in bob_received)

    def test_cancel_no_socket_event(self, socket_alice, socket_bob, alice_bob_swap, client):
        """Cancelling does not emit socket events."""
        swap_id = alice_bob_swap
        # Clear events received during fixture setup (e.g. new_swap_request)
        socket_alice.get_received("/")
        socket_bob.get_received("/")
        # alice_bob_swap leaves client as Alice, so cancel works
        resp = client.post(f"/api/swaps/{swap_id}/cancel", json={})
        assert resp.status_code == 200

        alice_received = socket_alice.get_received("/")
        bob_received = socket_bob.get_received("/")
        swap_events = ["swap_accepted", "swap_rejected", "new_swap_request"]
        assert not any(e["name"] in swap_events for e in alice_received)
        assert not any(e["name"] in swap_events for e in bob_received)


class TestSocketChatEvents:
    """6b: Real-time chat via socket."""

    def test_send_message_via_socket(self, socket_alice, socket_bob, alice_bob_swap):
        """Message sent via socket is received by both parties."""
        swap_id = alice_bob_swap
        socket_alice.emit("send_message", {
            "swap_id": swap_id,
            "content": "Hello from Alice!",
        })

        alice_received = socket_alice.get_received("/")
        bob_received = socket_bob.get_received("/")

        alice_msgs = [e for e in alice_received if e["name"] == "new_message"]
        bob_msgs = [e for e in bob_received if e["name"] == "new_message"]

        assert len(alice_msgs) >= 1
        assert alice_msgs[0]["args"][0]["content"] == "Hello from Alice!"
        assert len(bob_msgs) >= 1
        assert bob_msgs[0]["args"][0]["content"] == "Hello from Alice!"

    def test_send_message_persists(self, socket_alice, socket_bob, alice_bob_swap):
        """Message sent via socket is saved to database."""
        from app.models.chat import ChatMessage
        from app.extensions import db

        swap_id = alice_bob_swap
        socket_alice.emit("send_message", {
            "swap_id": swap_id,
            "content": "Persist this!",
        })

        with socket_alice.app.app_context():
            msg = ChatMessage.query.filter_by(
                swap_id=swap_id,
                content="Persist this!",
            ).first()
            assert msg is not None
            assert msg.sender_id == socket_alice.user_id

    def test_third_user_cannot_send_message(self, socket_alice, socket_bob, alice_bob_swap, client):
        """Third user (not swap participant) cannot send message on others' swap."""
        from app.extensions import socketio, db
        from app.models.chat import ChatMessage
        from app.models.user import User

        swap_id = alice_bob_swap

        resp = client.post("/auth/register", json={
            "name": "Charlie", "email": "charlie@example.com", "password": "password123",
        })
        assert resp.status_code == 201

        app = client.application
        sio_charlie = socketio.test_client(app, flask_test_client=client)
        assert sio_charlie.is_connected()
        with app.app_context():
            user = User.query.filter_by(email="charlie@example.com").first()
            sio_charlie.user_id = user.id
        sio_charlie.app = app

        sio_charlie.emit("send_message", {
            "swap_id": swap_id,
            "content": "Eavesdropping attempt!",
        })

        with sio_charlie.app.app_context():
            msgs = ChatMessage.query.filter_by(swap_id=swap_id).all()
            assert len(msgs) == 0

        alice_received = socket_alice.get_received("/")
        bob_received = socket_bob.get_received("/")
        assert not any(e["name"] == "new_message" for e in alice_received)
        assert not any(e["name"] == "new_message" for e in bob_received)

    def test_system_message_on_accept(self, socket_alice, socket_bob, alice_bob_swap, client):
        """System message created and emitted when swap is accepted."""
        from app.models.chat import ChatMessage

        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        client.post(f"/api/swaps/{swap_id}/accept", json={})

        with socket_alice.app.app_context():
            msgs = ChatMessage.query.filter_by(swap_id=swap_id, type="system").all()
            assert len(msgs) >= 1
            assert "accepted" in msgs[0].content.lower()

        alice_received = socket_alice.get_received("/")
        system_events = [
            e for e in alice_received
            if e["name"] == "new_message" and e["args"][0].get("type") == "system"
        ]
        assert len(system_events) >= 1

    def test_system_message_on_complete(self, socket_alice, socket_bob, alice_bob_swap, client):
        """System message emitted when swap is completed."""
        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        client.post(f"/api/swaps/{swap_id}/accept", json={})
        _as(client, "alice@example.com")
        client.post(f"/api/swaps/{swap_id}/complete", json={})

        alice_received = socket_alice.get_received("/")
        system_events = [
            e for e in alice_received
            if e["name"] == "new_message" and e["args"][0].get("type") == "system"
        ]
        assert len(system_events) >= 2  # accept + complete


class TestSocketPresence:
    """6d: User presence (online/offline)."""

    def test_connect_triggers_online(self, sockets_bob_then_alice):
        """When Alice connects, Bob receives user_online."""
        socket_alice, socket_bob = sockets_bob_then_alice
        bob_received = socket_bob.get_received("/")
        online_events = [
            e for e in bob_received
            if e["name"] == "user_online" and e["args"][0]["user_id"] == socket_alice.user_id
        ]
        assert len(online_events) >= 1

    def test_disconnect_triggers_offline(self, socket_alice, socket_bob, client):
        """When Alice disconnects, Bob receives user_offline."""
        alice_id = socket_alice.user_id
        socket_alice.disconnect()

        bob_received = socket_bob.get_received("/")
        offline_events = [
            e for e in bob_received
            if e["name"] == "user_offline" and e["args"][0]["user_id"] == alice_id
        ]
        assert len(offline_events) >= 1

    def test_presence_tracking_multiple_users(self, socket_alice, socket_bob):
        """Server tracks connected users correctly."""
        from app.extensions import socketio
        rooms = socketio.server.manager.rooms.get("/", {})
        user_rooms = {k: v for k, v in (rooms or {}).items() if k and k.startswith("user_")}
        assert len(user_rooms) >= 2


class TestSocketNotifications:
    """6c: Notification events via socket."""

    def test_notification_on_new_swap(self, socket_alice, client, user_skills):
        """Receiver gets notification event on new swap request."""
        from app.models.user import User
        with client.application.app_context():
            alice = User.query.filter_by(email="alice@example.com").first()

        _as(client, "bob@example.com")
        resp = client.post("/api/swaps", json={
            "receiver_id": alice.id,
            "offered_skill_id": user_skills["bob_python"],
            "wanted_skill_id": user_skills["alice_react"],
        })
        assert resp.status_code == 201

        alice_received = socket_alice.get_received("/")
        notifications = [
            e for e in alice_received
            if e["name"] == "notification" and e["args"][0].get("type") == "new_swap_request"
        ]
        assert len(notifications) >= 1
        assert notifications[0]["args"][0]["message"] is not None

    def test_notification_on_accept(self, socket_alice, socket_bob, alice_bob_swap, client):
        """Sender gets notification on accept."""
        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        client.post(f"/api/swaps/{swap_id}/accept", json={})

        alice_received = socket_alice.get_received("/")
        notifications = [
            e for e in alice_received
            if e["name"] == "notification" and e["args"][0].get("type") == "swap_accepted"
        ]
        assert len(notifications) >= 1

    def test_notification_on_reject(self, socket_alice, socket_bob, alice_bob_swap, client):
        """Sender gets notification on reject."""
        swap_id = alice_bob_swap
        _as(client, "bob@example.com")
        client.post(f"/api/swaps/{swap_id}/reject", json={})

        alice_received = socket_alice.get_received("/")
        notifications = [
            e for e in alice_received
            if e["name"] == "notification" and e["args"][0].get("type") == "swap_rejected"
        ]
        assert len(notifications) >= 1


class TestSocketTyping:
    """6e: Typing indicators."""

    def test_typing_relayed(self, socket_alice, socket_bob, alice_bob_swap):
        """Typing event routed to swap partner."""
        swap_id = alice_bob_swap
        socket_alice.emit("typing", {"swap_id": swap_id, "user_id": socket_alice.user_id})

        bob_received = socket_bob.get_received("/")
        events = [
            e for e in bob_received
            if e["name"] == "user_typing" and e["args"][0]["user_id"] == socket_alice.user_id
        ]
        assert len(events) >= 1

    def test_stopped_typing_relayed(self, socket_alice, socket_bob, alice_bob_swap):
        """Stopped typing event routed to swap partner."""
        swap_id = alice_bob_swap
        socket_alice.emit("stopped_typing", {"swap_id": swap_id, "user_id": socket_alice.user_id})

        bob_received = socket_bob.get_received("/")
        events = [
            e for e in bob_received
            if e["name"] == "user_stopped_typing" and e["args"][0]["user_id"] == socket_alice.user_id
        ]
        assert len(events) >= 1
