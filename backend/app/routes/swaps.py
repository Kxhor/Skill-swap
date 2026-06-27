from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy.orm import selectinload
from app.extensions import db, socketio
from app.models.user import User
from app.models.user_skill import UserSkill
from app.models.swap_request import SwapRequest
from app.models.chat import ChatMessage
from app.models.scheduled_session import ScheduledSession
from app.utils.validators import sanitize_text

swaps_bp = Blueprint("swaps", __name__)


@swaps_bp.before_request
def _reject_admin():
    if hasattr(current_user, "role"):
        return jsonify({"error": "Admin accounts cannot access user endpoints"}), 403


@swaps_bp.route("", methods=["GET"])
@login_required
def list_swaps():
    tab = request.args.get("tab", "all")
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)

    query = SwapRequest.query.filter(
        (SwapRequest.sender_id == current_user.id) | (SwapRequest.receiver_id == current_user.id)
    )

    if tab == "pending":
        query = query.filter(SwapRequest.status == "pending")
    elif tab == "accepted":
        query = query.filter(SwapRequest.status == "accepted")
    elif tab == "completed":
        query = query.filter(SwapRequest.status == "completed")
    elif tab == "cancelled":
        query = query.filter(SwapRequest.status == "cancelled")
    elif tab == "rejected":
        query = query.filter(SwapRequest.status == "rejected")

    query = query.options(
        selectinload(SwapRequest.sender),
        selectinload(SwapRequest.receiver),
        selectinload(SwapRequest.offered_skill).selectinload(UserSkill.skill),
        selectinload(SwapRequest.offered_skill).selectinload(UserSkill.verified_badge),
        selectinload(SwapRequest.wanted_skill).selectinload(UserSkill.skill),
        selectinload(SwapRequest.wanted_skill).selectinload(UserSkill.verified_badge),
    )
    query = query.order_by(SwapRequest.updated_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "swaps": [s.to_dict() for s in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }), 200


@swaps_bp.route("", methods=["POST"])
@login_required
def create_swap():
    data = request.get_json(silent=True) or {}
    receiver_id = data.get("receiver_id", "").strip()
    offered_skill_id = data.get("offered_skill_id", "").strip()
    wanted_skill_id = data.get("wanted_skill_id", "").strip()
    message = data.get("message", "").strip()

    if not receiver_id or not offered_skill_id or not wanted_skill_id:
        return jsonify({"error": "receiver_id, offered_skill_id, and wanted_skill_id are required"}), 422

    if receiver_id == current_user.id:
        return jsonify({"error": "You cannot swap with yourself"}), 422

    receiver = User.query.get(receiver_id)
    if not receiver or receiver.is_banned:
        return jsonify({"error": "Invalid user"}), 404

    offered_skill = UserSkill.query.get(offered_skill_id)
    if not offered_skill or offered_skill.user_id != current_user.id or offered_skill.type != "offered":
        return jsonify({"error": "Invalid offered skill"}), 422

    wanted_skill = UserSkill.query.get(wanted_skill_id)
    if not wanted_skill or wanted_skill.user_id != receiver_id or wanted_skill.type != "offered":
        return jsonify({"error": "Invalid wanted skill"}), 422

    if offered_skill_id == wanted_skill_id:
        return jsonify({"error": "Offered and wanted skills must be different"}), 422

    existing = SwapRequest.query.filter(
        ((SwapRequest.sender_id == current_user.id) & (SwapRequest.receiver_id == receiver_id))
        | ((SwapRequest.sender_id == receiver_id) & (SwapRequest.receiver_id == current_user.id)),
        SwapRequest.status == "pending",
    ).first()
    if existing:
        return jsonify({"error": "You already have a pending swap request with this user"}), 409

    swap = SwapRequest(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        offered_skill_id=offered_skill_id,
        wanted_skill_id=wanted_skill_id,
    )
    db.session.add(swap)
    db.session.commit()

    socketio.emit("new_swap_request", {
        "swap": swap.to_dict(),
        "message": f"New swap request from {current_user.name}",
    }, room=f"user_{receiver_id}")
    socketio.emit("notification", {
        "type": "new_swap_request",
        "swap_id": swap.id,
        "message": f"New swap request from {current_user.name}",
    }, room=f"user_{receiver_id}")
    socketio.emit("swap_status_changed", {
        "swap_id": swap.id,
        "status": "pending",
        "previous_status": None,
    }, room=f"user_{receiver_id}")
    socketio.emit("swap_status_changed", {
        "swap_id": swap.id,
        "status": "pending",
        "previous_status": None,
    }, room=f"user_{current_user.id}")

    return jsonify({"message": "Swap request sent", "swap": swap.to_dict()}), 201


@swaps_bp.route("/<swap_id>", methods=["GET"])
@login_required
def get_swap(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify({"swap": swap.to_dict()}), 200


@swaps_bp.route("/<swap_id>/accept", methods=["POST"])
@login_required
def accept_swap(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.receiver_id != current_user.id:
        return jsonify({"error": "Only the receiver can accept this swap"}), 403
    if swap.status != "pending":
        return jsonify({"error": "This swap request has already been processed"}), 409

    swap.status = "accepted"

    system_msg = ChatMessage(
        swap_id=swap.id,
        sender_id=None,
        content="Swap accepted! You can now chat to coordinate your skill exchange.",
        type="system",
    )
    db.session.add(system_msg)
    db.session.commit()

    accepted_data = {
        "swap": swap.to_dict(),
        "message": f"Your swap request was accepted by {current_user.name}",
    }
    socketio.emit("swap_accepted", accepted_data, room=f"user_{swap.sender_id}")
    socketio.emit("swap_accepted", accepted_data, room=f"user_{swap.receiver_id}")
    socketio.emit("notification", {
        "type": "swap_accepted",
        "swap_id": swap.id,
        "message": f"Your swap request was accepted by {current_user.name}",
    }, room=f"user_{swap.sender_id}")
    socketio.emit("new_message", system_msg.to_dict(), room=f"user_{swap.sender_id}")
    socketio.emit("new_message", system_msg.to_dict(), room=f"user_{swap.receiver_id}")
    for uid in (swap.sender_id, swap.receiver_id):
        socketio.emit("swap_status_changed", {
            "swap_id": swap.id,
            "status": swap.status,
            "previous_status": "pending",
        }, room=f"user_{uid}")

    return jsonify({"message": "Swap accepted", "swap": swap.to_dict()}), 200


@swaps_bp.route("/<swap_id>/reject", methods=["POST"])
@login_required
def reject_swap(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.receiver_id != current_user.id:
        return jsonify({"error": "Only the receiver can reject this swap"}), 403
    if swap.status != "pending":
        return jsonify({"error": "This swap request has already been processed"}), 409

    swap.status = "rejected"
    db.session.commit()

    socketio.emit("swap_rejected", {
        "swap": swap.to_dict(),
        "message": f"Your swap request was rejected by {current_user.name}",
    }, room=f"user_{swap.sender_id}")
    socketio.emit("notification", {
        "type": "swap_rejected",
        "swap_id": swap.id,
        "message": f"Your swap request was rejected by {current_user.name}",
    }, room=f"user_{swap.sender_id}")
    for uid in (swap.sender_id, swap.receiver_id):
        socketio.emit("swap_status_changed", {
            "swap_id": swap.id,
            "status": swap.status,
            "previous_status": "pending",
        }, room=f"user_{uid}")

    return jsonify({"message": "Swap rejected", "swap": swap.to_dict()}), 200


@swaps_bp.route("/<swap_id>/cancel", methods=["POST"])
@login_required
def cancel_swap(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id:
        return jsonify({"error": "Only the sender can cancel this swap"}), 403
    if swap.status != "pending":
        return jsonify({"error": "Only pending swaps can be cancelled"}), 409

    swap.status = "cancelled"
    db.session.commit()

    for uid in (swap.sender_id, swap.receiver_id):
        socketio.emit("swap_status_changed", {
            "swap_id": swap.id,
            "status": swap.status,
            "previous_status": "pending",
        }, room=f"user_{uid}")

    return jsonify({"message": "Swap cancelled", "swap": swap.to_dict()}), 200


@swaps_bp.route("/<swap_id>/complete", methods=["POST"])
@login_required
def complete_swap(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    if swap.status != "accepted":
        return jsonify({"error": "Only accepted swaps can be marked as completed"}), 409

    swap.status = "completed"

    system_msg = ChatMessage(
        swap_id=swap.id,
        sender_id=None,
        content="Swap completed! You can now leave feedback for each other.",
        type="system",
    )
    db.session.add(system_msg)
    db.session.commit()

    socketio.emit("new_message", system_msg.to_dict(), room=f"user_{swap.sender_id}")
    socketio.emit("new_message", system_msg.to_dict(), room=f"user_{swap.receiver_id}")
    for uid in (swap.sender_id, swap.receiver_id):
        socketio.emit("swap_status_changed", {
            "swap_id": swap.id,
            "status": swap.status,
            "previous_status": "accepted",
        }, room=f"user_{uid}")

    return jsonify({"message": "Swap marked as completed. You can now leave feedback.", "swap": swap.to_dict()}), 200


@swaps_bp.route("/<swap_id>/messages", methods=["GET"])
@login_required
def get_messages(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    if swap.status != "accepted" and swap.status != "completed":
        return jsonify({"error": "Chat is not available for this swap status"}), 400

    messages = ChatMessage.query.filter_by(swap_id=swap_id).order_by(ChatMessage.created_at).limit(100).all()
    return jsonify({"messages": [m.to_dict() for m in messages]}), 200


@swaps_bp.route("/<swap_id>/messages", methods=["POST"])
@login_required
def send_message(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    if swap.status != "accepted":
        return jsonify({"error": "Chat is only available for accepted swaps"}), 400

    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Message cannot be empty"}), 422
    if len(content) > 5000:
        return jsonify({"error": "Message too long (max 5000 characters)"}), 422

    content = sanitize_text(content)

    message = ChatMessage(
        swap_id=swap_id,
        sender_id=current_user.id,
        content=content,
        type="user",
    )
    db.session.add(message)
    db.session.commit()

    message_data = message.to_dict()
    socketio.emit("new_message", message_data, room=f"swap_{swap_id}")

    return jsonify({"message": message_data}), 201


@swaps_bp.route("/<swap_id>/schedule", methods=["GET"])
@login_required
def get_session(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    session = ScheduledSession.query.filter_by(swap_id=swap_id).first()
    if not session:
        return jsonify({"session": None}), 200
    return jsonify({"session": session.to_dict()}), 200


@swaps_bp.route("/<swap_id>/schedule", methods=["POST"])
@login_required
def propose_session(swap_id):
    from app.utils.calendar_link import build_calendar_url

    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    if swap.status != "accepted":
        return jsonify({"error": "Swap must be accepted before scheduling"}), 422

    existing = ScheduledSession.query.filter_by(swap_id=swap_id).first()
    if existing:
        return jsonify({"error": "Session already scheduled"}), 409

    data = request.get_json(silent=True) or {}
    scheduled_at_str = data.get("scheduled_at", "").strip()
    if not scheduled_at_str:
        return jsonify({"error": "scheduled_at is required"}), 422

    try:
        scheduled_at = datetime.fromisoformat(scheduled_at_str)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid datetime format (use ISO 8601)"}), 422

    if scheduled_at <= datetime.now(timezone.utc):
        return jsonify({"error": "Scheduled time must be in the future"}), 422

    title = f"Skill Swap: {swap.offered_skill.skill.name if swap.offered_skill and swap.offered_skill.skill else 'Skill'} ↔ {swap.wanted_skill.skill.name if swap.wanted_skill and swap.wanted_skill.skill else 'Skill'}"
    cal_url = build_calendar_url(title, f"Peer learning session between {swap.sender.name} and {swap.receiver.name}", scheduled_at)

    session = ScheduledSession(
        swap_id=swap_id,
        proposer_id=current_user.id,
        scheduled_at=scheduled_at,
        calendar_link=cal_url,
    )
    db.session.add(session)
    db.session.commit()

    return jsonify({"session": session.to_dict()}), 201


@swaps_bp.route("/<swap_id>/schedule/confirm", methods=["POST"])
@login_required
def confirm_session(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    session = ScheduledSession.query.filter_by(swap_id=swap_id).first()
    if not session:
        return jsonify({"error": "No session proposed"}), 404
    if session.proposer_id == current_user.id:
        return jsonify({"error": "You cannot confirm your own proposal"}), 422
    if session.status != "proposed":
        return jsonify({"error": f"Session is already {session.status}"}), 422

    session.status = "confirmed"
    db.session.commit()
    return jsonify({"session": session.to_dict()}), 200
