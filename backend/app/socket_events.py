"""Socket.IO event handlers for real-time features."""

import time
from datetime import datetime, timezone
from flask import session as flask_session, request
from flask_login import current_user
from app.extensions import socketio, db

# In-memory per-user throttle for typing events.
# Stores {user_id: last_emit_timestamp}. Since typing events are UI-only
# and stateless we don't need Redis — in-process is fine for portfolio scale.
_typing_throttle: dict[str, float] = {}
_TYPING_INTERVAL_SEC = 2.0  # minimum seconds between typing emits per user

# In-memory per-user rolling window rate limiter for chat messages.
# Mirrors the 30-per-minute limit on the REST endpoint in routes/swaps.py.
_message_rate_limit: dict[str, list[float]] = {}
_MESSAGE_WINDOW_SEC = 60.0
_MESSAGE_MAX_PER_WINDOW = 30


def register_socket_events():
    """Register all Socket.IO event handlers."""


    @socketio.on("connect")
    def handle_connect():
        """Authenticate connection via session cookie, join user room."""
        user_id = flask_session.get("_user_id")
        if not user_id:
            return False
        from app.models.user import User
        user = User.query.get(user_id)
        if not user or not user.is_active:
            return False

        flask_session["socket_user_id"] = user_id

        socketio.server.enter_room(request.sid, f"user_{user_id}")

        # Notify other users that this user is online
        socketio.emit("user_online", {
            "user_id": user_id,
            "name": user.name,
        }, include_self=False)

        # Auto-join swap rooms (for existing swaps at connect time)
        _join_user_swap_rooms(user_id)

        return True

    @socketio.on("disconnect")
    def handle_disconnect():
        """Notify other users about disconnection."""
        user_id = flask_session.get("socket_user_id")
        if user_id:
            socketio.emit("user_offline", {
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, include_self=False)
            _message_rate_limit.pop(user_id, None)
            _typing_throttle.pop(user_id, None)

    @socketio.on("join")
    def handle_join(data):
        """Join a room. Validates access: user rooms must be own; swap rooms must be participant."""
        room = data.get("room")
        if not room:
            return
        user_id = flask_session.get("socket_user_id")
        if not user_id:
            return

        # user_ rooms: only allow joining own
        if room.startswith("user_") and room != f"user_{user_id}":
            return

        # swap_ rooms: only allow participants
        if room.startswith("swap_"):
            swap_id = room.split("_", 1)[1] if "_" in room else None
            if not swap_id:
                return
            from app.models.swap_request import SwapRequest
            swap = SwapRequest.query.get(swap_id)
            if not swap or (swap.sender_id != user_id and swap.receiver_id != user_id):
                return

        socketio.server.enter_room(request.sid, room)

    @socketio.on("leave")
    def handle_leave(data):
        """Leave a room."""
        room = data.get("room")
        if room:
            socketio.server.leave_room(request.sid, room)

    @socketio.on("send_message")
    def handle_send_message(data):
        """Persist and broadcast a chat message to the swap room."""
        from app.utils.validators import sanitize_text
        
        swap_id = data.get("swap_id")
        content = data.get("content", "").strip()
        user_id = flask_session.get("socket_user_id")

        if not swap_id or not content or not user_id:
            return

        if len(content) > 2000:
            socketio.emit("error", {"message": "Message too long (max 2000 characters)"}, room=f"user_{user_id}")
            return

        from app.utils.profanity import contains_profanity
        if contains_profanity(content):
            socketio.emit("error", {"message": "This message contains language that goes against our community guidelines."}, room=f"user_{user_id}")
            return

        # Rolling window rate limiter: max 30 messages per 60 seconds per user
        now = time.monotonic()
        cutoff = now - _MESSAGE_WINDOW_SEC
        user_timestamps = [t for t in _message_rate_limit.get(user_id, []) if t > cutoff]
        if len(user_timestamps) >= _MESSAGE_MAX_PER_WINDOW:
            _message_rate_limit[user_id] = user_timestamps
            socketio.emit("error", {"message": "You're sending messages too fast. Please slow down."}, room=f"user_{user_id}")
            return

        user_timestamps.append(now)
        _message_rate_limit[user_id] = user_timestamps

        # Sanitize and cap per message — mirrors HTTP route validation
        content = sanitize_text(content, max_length=2000)
        if not content:
            return


        from app.models.swap_request import SwapRequest
        swap = SwapRequest.query.get(swap_id)
        if not swap:
            return
        if swap.sender_id != user_id and swap.receiver_id != user_id:
            return
        if swap.status != "accepted":
            socketio.emit("error", {"message": "Chat is only available for accepted swaps"}, room=f"user_{user_id}")
            return

        from app.models.chat import ChatMessage
        msg = ChatMessage(
            swap_id=swap_id,
            sender_id=user_id,
            content=content,
            type="user",
        )
        db.session.add(msg)
        db.session.commit()

        msg_dict = msg.to_dict()
        socketio.emit("new_message", msg_dict, room=f"user_{swap.sender_id}")
        if swap.sender_id != swap.receiver_id:
            socketio.emit("new_message", msg_dict, room=f"user_{swap.receiver_id}")

    @socketio.on("typing")
    def handle_typing(data):
        """Relay typing indicator to swap partner — throttled to 1 emit per 2s per user."""
        import time
        swap_id = data.get("swap_id")
        user_id = flask_session.get("socket_user_id")
        if not swap_id or not user_id:
            return

        # Throttle: silently drop if this user emitted typing < 2s ago
        now = time.monotonic()
        last = _typing_throttle.get(user_id, 0.0)
        if now - last < _TYPING_INTERVAL_SEC:
            return
        _typing_throttle[user_id] = now

        from app.models.swap_request import SwapRequest
        swap = SwapRequest.query.get(swap_id)
        if not swap:
            return
        if swap.sender_id != user_id and swap.receiver_id != user_id:
            return
        if swap.status != "accepted":
            return

        partner_room = f"user_{swap.receiver_id}" if swap.sender_id == user_id else f"user_{swap.sender_id}"
        socketio.emit("user_typing", {
            "user_id": user_id,
            "swap_id": swap_id,
        }, room=partner_room)

    @socketio.on("stopped_typing")
    def handle_stopped_typing(data):
        """Relay stopped typing indicator to swap partner."""
        swap_id = data.get("swap_id")
        user_id = flask_session.get("socket_user_id")
        if not swap_id or not user_id:
            return

        from app.models.swap_request import SwapRequest
        swap = SwapRequest.query.get(swap_id)
        if not swap:
            return
        if swap.sender_id != user_id and swap.receiver_id != user_id:
            return
        if swap.status != "accepted":
            return

        partner_room = f"user_{swap.receiver_id}" if swap.sender_id == user_id else f"user_{swap.sender_id}"
        socketio.emit("user_stopped_typing", {
            "user_id": user_id,
            "swap_id": swap_id,
        }, room=partner_room)


def _join_user_swap_rooms(user_id):
    """Join swap rooms for all active swaps the user is part of."""
    from app.models.swap_request import SwapRequest
    swaps = SwapRequest.query.filter(
        (SwapRequest.sender_id == user_id) | (SwapRequest.receiver_id == user_id),
        SwapRequest.status.in_(["pending", "accepted"]),
    ).all()
    for swap in swaps:
        room = f"swap_{swap.id}"
        socketio.server.enter_room(request.sid, room)
