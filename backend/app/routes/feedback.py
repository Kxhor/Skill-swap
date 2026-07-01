from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.extensions import db, limiter
from app.models.user import User
from app.models.feedback import Feedback
from app.models.swap_request import SwapRequest
from app.models.verified_badge import VerifiedBadge
from app.utils.validators import validate_rating, sanitize_text

feedback_bp = Blueprint("feedback", __name__)


@feedback_bp.before_request
def _reject_admin():
    if hasattr(current_user, "role"):
        return jsonify({"error": "Admin accounts cannot access user endpoints"}), 403


@feedback_bp.route("", methods=["POST"])
@login_required
@limiter.limit("10 per minute")
def submit_feedback():
    data = request.get_json(silent=True) or {}
    swap_id = data.get("swap_id", "").strip()
    rating = data.get("rating")
    comment = data.get("comment", "").strip()

    if len(comment) > 2000:
        return jsonify({"error": "Comment too long (max 2000 characters)"}), 422

    if not swap_id or rating is None:
        return jsonify({"error": "swap_id and rating are required"}), 422

    is_valid, msg = validate_rating(rating)
    if not is_valid:
        return jsonify({"error": msg}), 422

    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "You can only rate swaps you participated in"}), 403
    if swap.status != "completed":
        return jsonify({"error": "You can only rate completed swaps"}), 422

    existing = Feedback.query.filter_by(swap_id=swap_id, rater_id=current_user.id).first()
    if existing:
        return jsonify({"error": "You have already rated this swap"}), 409

    rated_id = swap.receiver_id if swap.sender_id == current_user.id else swap.sender_id

    feedback = Feedback(
        swap_id=swap_id,
        rater_id=current_user.id,
        rated_id=rated_id,
        rating=int(rating),
        comment=sanitize_text(comment) if comment else None,
    )
    db.session.add(feedback)
    db.session.flush()

    if int(rating) >= 4:
        _award_verified_badge_if_eligible(rated_id)

    db.session.commit()

    return jsonify({"message": "Feedback submitted", "feedback": feedback.to_dict()}), 201


def _award_verified_badge_if_eligible(user_id: str):
    from app.models.user_skill import UserSkill
    from sqlalchemy.exc import IntegrityError

    user_skills = UserSkill.query.filter_by(user_id=user_id, type="offered").all()
    for us in user_skills:
        badge = VerifiedBadge.query.filter_by(user_skill_id=us.id).first()
        if badge:
            continue

        skill_feedbacks = Feedback.query.join(
            SwapRequest,
            Feedback.swap_id == SwapRequest.id,
        ).filter(
            Feedback.rated_id == user_id,
            Feedback.rating >= 4,
            (
                (SwapRequest.offered_skill_id == us.id)
                | (SwapRequest.wanted_skill_id == us.id)
            ),
        ).count()

        if skill_feedbacks >= 3:
            try:
                with db.session.begin_nested():
                    badge = VerifiedBadge(user_skill_id=us.id)
                    db.session.add(badge)
            except IntegrityError:
                pass


@feedback_bp.route("/user/<user_id>", methods=["GET"])
@login_required
def user_feedback(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    feedback_list = Feedback.query.filter_by(rated_id=user.id).order_by(Feedback.created_at.desc()).limit(100).all()
    avg = Feedback.query.with_entities(db.func.avg(Feedback.rating)).filter_by(rated_id=user.id).scalar()
    count = Feedback.query.filter_by(rated_id=user.id).count()

    distribution = {}
    for i in range(1, 6):
        distribution[str(i)] = Feedback.query.filter_by(rated_id=user.id, rating=i).count()

    return jsonify({
        "feedback": [f.to_dict() for f in feedback_list],
        "average_rating": round(float(avg), 1) if avg else None,
        "rating_count": count,
        "rating_distribution": distribution,
    }), 200


@feedback_bp.route("/swap/<swap_id>", methods=["GET"])
@login_required
def swap_feedback(swap_id):
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({"error": "Swap not found"}), 404
    if swap.sender_id != current_user.id and swap.receiver_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    feedback_list = Feedback.query.filter_by(swap_id=swap_id).all()
    return jsonify({"feedback": [f.to_dict() for f in feedback_list]}), 200
