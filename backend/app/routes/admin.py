from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from functools import wraps
from app.extensions import db, socketio
from app.models.user import User
from app.models.skill import Skill
from app.models.user_skill import UserSkill
from app.models.swap_request import SwapRequest
from app.models.feedback import Feedback
from app.models.chat import ChatMessage
from datetime import datetime, timezone, timedelta

admin_bp = Blueprint("admin", __name__)


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not hasattr(current_user, "role"):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


@admin_bp.route("/stats", methods=["GET"])
@admin_required
def stats():
    total_users = User.query.count()
    active_users = User.query.filter_by(is_banned=False).count()
    banned_users = User.query.filter_by(is_banned=True).count()
    total_swaps = SwapRequest.query.count()
    pending_swaps = SwapRequest.query.filter_by(status="pending").count()
    accepted_swaps = SwapRequest.query.filter_by(status="accepted").count()
    completed_swaps = SwapRequest.query.filter_by(status="completed").count()
    total_skills = Skill.query.count()
    pending_skills = Skill.query.filter_by(status="pending").count()
    approved_skills = Skill.query.filter_by(status="approved").count()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_week = User.query.filter(User.created_at >= week_ago).count()
    new_swaps_week = SwapRequest.query.filter(SwapRequest.created_at >= week_ago).count()

    avg_rating_row = db.session.query(db.func.avg(Feedback.rating)).first()
    average_rating = round(float(avg_rating_row[0]), 2) if avg_rating_row and avg_rating_row[0] is not None else 0.0

    return jsonify({
        "total_users": total_users,
        "active_users": active_users,
        "banned_users": banned_users,
        "total_swaps": total_swaps,
        "pending_swaps": pending_swaps,
        "active_swaps": accepted_swaps,
        "accepted_swaps": accepted_swaps,
        "completed_swaps": completed_swaps,
        "total_skills": total_skills,
        "pending_skills": pending_skills,
        "approved_skills": approved_skills,
        "new_users_week": new_users_week,
        "new_swaps_week": new_swaps_week,
        "average_rating": average_rating,
    }), 200


@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "all")
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    query = User.query
    if search:
        query = query.filter(User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    if status_filter == "active":
        query = query.filter_by(is_banned=False)
    elif status_filter == "banned":
        query = query.filter_by(is_banned=True)

    query = query.order_by(User.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    results = []
    for u in pagination.items:
        data = u.to_dict(include_email=True)
        data["rating_count"] = Feedback.query.filter_by(rated_id=u.id).count()
        results.append(data)

    return jsonify({
        "users": results,
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }), 200


@admin_bp.route("/users/<user_id>/ban", methods=["POST"])
@admin_required
def ban_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.is_banned:
        return jsonify({"error": "User is already banned"}), 409
    user.is_banned = True
    db.session.commit()
    return jsonify({"message": f"User '{user.name}' has been banned"}), 200


@admin_bp.route("/users/<user_id>/unban", methods=["POST"])
@admin_required
def unban_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not user.is_banned:
        return jsonify({"error": "User is not banned"}), 409
    user.is_banned = False
    db.session.commit()
    return jsonify({"message": f"User '{user.name}' has been unbanned"}), 200


@admin_bp.route("/skills", methods=["GET"])
@admin_required
def list_skills():
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "all")
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    query = Skill.query
    if search:
        query = query.filter(Skill.name.ilike(f"%{search}%"))
    if status_filter in ("pending", "approved", "rejected"):
        query = query.filter(Skill.status == status_filter)

    query = query.order_by(Skill.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    results = []
    for s in pagination.items:
        data = s.to_dict()
        data["user_count"] = UserSkill.query.filter_by(skill_id=s.id).count()
        results.append(data)

    return jsonify({
        "skills": results,
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }), 200


@admin_bp.route("/skills/<skill_id>/approve", methods=["POST"])
@admin_required
def approve_skill(skill_id):
    skill = Skill.query.get(skill_id)
    if not skill:
        return jsonify({"error": "Skill not found"}), 404
    if skill.status == "approved":
        return jsonify({"error": "Skill is already approved"}), 409
    skill.status = "approved"
    db.session.commit()
    return jsonify({"message": f"Skill '{skill.name}' approved"}), 200


@admin_bp.route("/skills/<skill_id>/reject", methods=["POST"])
@admin_required
def reject_skill(skill_id):
    skill = Skill.query.get(skill_id)
    if not skill:
        return jsonify({"error": "Skill not found"}), 404
    if skill.status == "rejected":
        return jsonify({"error": "Skill is already rejected"}), 409
    skill.status = "rejected"
    db.session.commit()
    return jsonify({"message": f"Skill '{skill.name}' rejected"}), 200


@admin_bp.route("/swaps", methods=["GET"])
@admin_required
def list_swaps():
    status_filter = request.args.get("status", "all")
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    query = SwapRequest.query
    if status_filter != "all":
        query = query.filter(SwapRequest.status == status_filter)

    query = query.order_by(SwapRequest.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "swaps": [s.to_dict() for s in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }), 200


@admin_bp.route("/feedback", methods=["GET"])
@admin_required
def list_feedback():
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    query = Feedback.query.order_by(Feedback.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    results = []
    for f in pagination.items:
        d = f.to_dict()
        sender = User.query.get(f.rater_id)
        d["sender_name"] = sender.name if sender else None
        results.append(d)

    return jsonify({
        "feedback": results,
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    }), 200


@admin_bp.route("/feedback/<feedback_id>", methods=["DELETE"])
@admin_required
def delete_feedback(feedback_id):
    fb = Feedback.query.get(feedback_id)
    if not fb:
        return jsonify({"error": "Feedback not found"}), 404
    db.session.delete(fb)
    db.session.commit()
    return jsonify({"message": "Feedback deleted"}), 200


@admin_bp.route("/swaps/<swap_id>", methods=["DELETE"])
@admin_required
def delete_swap(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    db.session.delete(swap)
    db.session.commit()
    return jsonify({"message": "Swap deleted"}), 200


@admin_bp.route("/announcements", methods=["POST"])
@admin_required
def send_announcement():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    message = data.get("message", "").strip()
    msg_type = data.get("type", "info")
    if msg_type not in ("info", "warning", "error", "success"):
        msg_type = "info"

    if not title or not message:
        return jsonify({"error": "Title and message are required"}), 422

    socketio.emit("admin_broadcast", {
        "title": title,
        "message": message,
        "type": msg_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return jsonify({"message": f"Announcement '{title}' sent"}), 200


@admin_bp.route("/activity", methods=["GET"])
@admin_required
def recent_activity():
    limit = min(request.args.get("limit", 10, type=int), 50)

    recent_users = User.query.order_by(User.created_at.desc()).limit(limit).all()
    recent_swaps = SwapRequest.query.order_by(SwapRequest.created_at.desc()).limit(limit).all()

    activity = []
    for u in recent_users:
        activity.append({"type": "user_registered", "data": u.to_dict(), "timestamp": u.created_at.isoformat()})
    for s in recent_swaps:
        activity.append({"type": f"swap_{s.status}", "data": s.to_dict(), "timestamp": s.created_at.isoformat()})

    activity.sort(key=lambda x: x["timestamp"], reverse=True)
    activity = activity[:limit]

    return jsonify({"activity": activity}), 200
