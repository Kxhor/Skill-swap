from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from app.extensions import db, limiter
from app.models.user import User
from app.models.skill import Skill
from app.models.user_skill import UserSkill
from app.models.availability import Availability
from app.models.feedback import Feedback
from app.utils.validators import validate_name, validate_location, validate_skill_name, validate_proficiency_level, validate_skill_type, sanitize_text
from app.utils.cloudinary_upload import upload_photo
from app.models.follow import Follow
from datetime import time

users_bp = Blueprint("users", __name__)


def _reject_admin():
    if hasattr(current_user, "role"):
        return jsonify({"error": "Admin accounts cannot access user endpoints"}), 403
    return None


@users_bp.route("", methods=["GET"])
@login_required
def list_users():
    search = request.args.get("search", "").strip()
    skill = request.args.get("skill", "").strip()
    skill_type = request.args.get("type", "offered")
    location = request.args.get("location", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 12, type=int), 50)

    query = User.query.filter(User.is_banned == False)

    if search:
        query = query.filter(User.name.ilike(f"%{search}%"))
    if location:
        query = query.filter(User.location.ilike(f"%{location}%"))
    if skill:
        user_ids = (
            UserSkill.query
            .join(Skill)
            .filter(Skill.name.ilike(f"%{skill}%"), UserSkill.type == skill_type)
            .with_entities(UserSkill.user_id)
            .distinct()
            .subquery()
        )
        query = query.filter(User.id.in_(db.session.query(user_ids.c.user_id)))

    query = query.order_by(User.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    # Fix N+1: fetch all skills for the page's users in 2 bulk queries
    # instead of 2 queries × N users inside the loop below.
    user_ids_on_page = [u.id for u in pagination.items]
    all_skills = (
        UserSkill.query
        .join(Skill)
        .filter(UserSkill.user_id.in_(user_ids_on_page))
        .options(db.joinedload(UserSkill.skill), db.joinedload(UserSkill.verified_badge))
        .all()
    )

    # Group skills by user_id in Python — O(skills) not O(users × skills)
    offered_map: dict[str, list] = {}
    wanted_map: dict[str, list] = {}
    for s in all_skills:
        if s.type == "offered":
            offered_map.setdefault(s.user_id, []).append(s.to_dict())
        elif s.type == "wanted":
            wanted_map.setdefault(s.user_id, []).append(s.to_dict())

    results = []
    for u in pagination.items:
        user_data = u.to_dict()
        user_data["skills_offered"] = offered_map.get(u.id, [])
        user_data["skills_wanted"] = wanted_map.get(u.id, [])
        results.append(user_data)

    return jsonify({
        "users": results,
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
        "per_page": per_page,
    }), 200



@users_bp.route("/profile", methods=["GET", "PUT", "DELETE"])
@login_required
@limiter.limit("20 per minute")
def profile():
    reject = _reject_admin()
    if reject:
        return reject

    if request.method == "DELETE":
        # Anonymize user to preserve swap history
        current_user.name = "Deleted User"
        current_user.email = f"deleted_{current_user.id}@skillswap.local"
        current_user.password_hash = "DELETED"
        current_user.bio = None
        current_user.location = None
        current_user.photo_url = None
        current_user.linkedin_id = None
        current_user.github_id = None
        current_user.instagram_id = None
        current_user.is_banned = True
        
        db.session.commit()
        return jsonify({"message": "Account successfully deleted and anonymized"}), 200

    if request.method == "GET":
        offered = UserSkill.query.filter_by(user_id=current_user.id, type="offered").options(db.joinedload(UserSkill.skill), db.joinedload(UserSkill.verified_badge)).all()
        wanted = UserSkill.query.filter_by(user_id=current_user.id, type="wanted").options(db.joinedload(UserSkill.skill), db.joinedload(UserSkill.verified_badge)).all()
        avail = Availability.query.filter_by(user_id=current_user.id).all()
        avg_rating = Feedback.query.with_entities(db.func.avg(Feedback.rating)).filter_by(rated_id=current_user.id).scalar()

        result = current_user.to_dict(include_email=True, include_counts=True)
        result["skills_offered"] = [s.to_dict() for s in offered]
        result["skills_wanted"] = [s.to_dict() for s in wanted]
        result["availability"] = [a.to_dict() for a in avail]
        result["average_rating"] = round(float(avg_rating), 1) if avg_rating else None
        return jsonify({"user": result}), 200

    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    location = data.get("location", "").strip()
    bio = data.get("bio", "")
    bio = sanitize_text(bio) if bio else ""
    linkedin_id = data.get("linkedin_id", "").strip()
    github_id = data.get("github_id", "").strip()
    instagram_id = data.get("instagram_id", "").strip()
    dob = data.get("dob", "").strip()
    swap_username = data.get("swap_username", "").strip()

    errors = []
    if not name:
        errors.append("Name is required")
    else:
        is_valid, msg = validate_name(name)
        if not is_valid:
            errors.append(msg)
    if location:
        is_valid, msg = validate_location(location)
        if not is_valid:
            errors.append(msg)
            
    if bio and len(bio) > 1000:
        errors.append("Bio must not exceed 1000 characters")
            
    if swap_username:
        # Simple regex for username format
        import re
        if not re.match(r'^[a-z0-9_]+$', swap_username):
            errors.append("Username can only contain lowercase letters, numbers, and underscores")
        existing = User.query.filter(User.swap_username == swap_username, User.id != current_user.id).first()
        if existing:
            errors.append("Swap username is already taken")

    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 422

    current_user.name = name
    current_user.location = location or None
    current_user.bio = sanitize_text(bio) if bio else None
    current_user.linkedin_id = linkedin_id or None
    current_user.github_id = github_id or None
    current_user.instagram_id = instagram_id or None
    current_user.dob = dob or None
    if swap_username:
        current_user.swap_username = swap_username
    db.session.commit()

    return jsonify({"message": "Profile updated", "user": current_user.to_dict(include_email=True, include_counts=True)}), 200


@users_bp.route("/photo", methods=["POST", "DELETE"])
@login_required
@limiter.limit("5 per minute")
def upload_photo_route():
    reject = _reject_admin()
    if reject:
        return reject
        
    if request.method == "DELETE":
        current_user.photo_url = None
        db.session.commit()
        return jsonify({"message": "Photo deleted", "photo_url": None}), 200

    if "photo" not in request.files:
        return jsonify({"error": "No photo file provided"}), 422

    file = request.files["photo"]
    url, error = upload_photo(file, public_id=f"user_{current_user.id}")
    if error:
        return jsonify({"error": error}), 422

    current_user.photo_url = url
    db.session.commit()
    return jsonify({"message": "Photo uploaded", "photo_url": url}), 200


@users_bp.route("/skills", methods=["GET"])
@login_required
def get_my_skills():
    reject = _reject_admin()
    if reject:
        return reject
    offered = UserSkill.query.filter_by(user_id=current_user.id, type="offered").all()
    wanted = UserSkill.query.filter_by(user_id=current_user.id, type="wanted").all()
    return jsonify({
        "offered": [s.to_dict() for s in offered],
        "wanted": [s.to_dict() for s in wanted],
    }), 200


@users_bp.route("/skills", methods=["POST"])
@login_required
@limiter.limit("10 per minute")
def add_skill():
    reject = _reject_admin()
    if reject:
        return reject
    data = request.get_json(silent=True) or {}
    skill_name = data.get("skill_name", "").strip()
    skill_type = data.get("type", "offered")
    proficiency = data.get("proficiency", "intermediate")

    errors = []
    is_valid, msg = validate_skill_name(skill_name)
    if not is_valid:
        errors.append(msg)
    is_valid, msg = validate_skill_type(skill_type)
    if not is_valid:
        errors.append(msg)
    is_valid, msg = validate_proficiency_level(proficiency)
    if not is_valid:
        errors.append(msg)
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 422

    skill = Skill.query.filter_by(name=skill_name).first()
    if not skill:
        skill = Skill(name=skill_name)
        db.session.add(skill)
        db.session.flush()

    existing = UserSkill.query.filter_by(
        user_id=current_user.id, skill_id=skill.id, type=skill_type
    ).first()
    if existing:
        return jsonify({"error": f"You already have '{skill_name}' in your {skill_type} skills"}), 409

    user_skill = UserSkill(
        user_id=current_user.id,
        skill_id=skill.id,
        type=skill_type,
        proficiency=proficiency,
    )
    db.session.add(user_skill)
    db.session.commit()

    return jsonify({"message": f"'{skill_name}' added to your {skill_type} skills", "skill": user_skill.to_dict()}), 201


@users_bp.route("/skills/<skill_id>", methods=["PUT", "DELETE"])
@login_required
def modify_skill(skill_id):
    reject = _reject_admin()
    if reject:
        return reject
    user_skill = UserSkill.query.get(skill_id)
    if not user_skill:
        return jsonify({"error": "Skill not found"}), 404
    if user_skill.user_id != current_user.id:
        return jsonify({"error": "You can only modify your own skills"}), 403

    if request.method == "DELETE":
        db.session.delete(user_skill)
        db.session.commit()
        return jsonify({"message": "Skill removed"}), 200

    data = request.get_json(silent=True) or {}
    proficiency = data.get("proficiency")
    if proficiency:
        is_valid, msg = validate_proficiency_level(proficiency)
        if not is_valid:
            return jsonify({"error": msg}), 422
        user_skill.proficiency = proficiency
    db.session.commit()
    return jsonify({"message": "Skill updated", "skill": user_skill.to_dict()}), 200


@users_bp.route("/availability", methods=["GET", "POST"])
@login_required
def manage_availability():
    reject = _reject_admin()
    if reject:
        return reject
    if request.method == "GET":
        slots = Availability.query.filter_by(user_id=current_user.id).all()
        return jsonify({"availability": [s.to_dict() for s in slots]}), 200

    data = request.get_json(silent=True) or {}
    slots_data = data.get("slots") if isinstance(data, dict) else data
    if not isinstance(slots_data, list):
        return jsonify({"error": "Expected a list of availability slots"}), 422

    created = []
    for slot in slots_data:
        day = slot.get("day_of_week", "").strip().lower()
        start = slot.get("start_time")
        end = slot.get("end_time")
        if not day or not start or not end:
            continue
        try:
            # Robust parsing for HH:MM format
            if len(start) == 5:
                start += ":00"
            if len(end) == 5:
                end += ":00"
            start_t = time.fromisoformat(start)
            end_t = time.fromisoformat(end)
        except (ValueError, TypeError):
            continue
        av = Availability(
            user_id=current_user.id,
            day_of_week=day,
            start_time=start_t,
            end_time=end_t,
        )
        db.session.add(av)
        created.append(av)

    if not created:
        return jsonify({"error": "No valid availability slots provided"}), 400

    db.session.commit()
    return jsonify({"message": "Availability updated", "availability": [a.to_dict() for a in created]}), 201


@users_bp.route("/availability/<slot_id>", methods=["DELETE"])
@login_required
def delete_availability(slot_id):
    reject = _reject_admin()
    if reject:
        return reject
    slot = Availability.query.get(slot_id)
    if not slot:
        return jsonify({"error": "Availability slot not found"}), 404
    if slot.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(slot)
    db.session.commit()
    return jsonify({"message": "Availability slot deleted"}), 200


import time

_stats_cache = {"data": None, "timestamp": 0.0}
_STATS_CACHE_TTL = 300  # 5 minutes

@users_bp.route("/stats/community", methods=["GET"])
def community_stats():
    now = time.time()
    if _stats_cache["data"] and now - _stats_cache["timestamp"] < _STATS_CACHE_TTL:
        return jsonify(_stats_cache["data"]), 200

    from app.models.swap_request import SwapRequest
    from app.models.user_skill import UserSkill

    total_users = User.query.filter_by(is_banned=False).count()
    total_swaps = SwapRequest.query.count()
    pending_swaps = SwapRequest.query.filter_by(status="pending").count()
    accepted_swaps = SwapRequest.query.filter_by(status="accepted").count()
    completed_swaps = SwapRequest.query.filter_by(status="completed").count()
    avg_rating = Feedback.query.with_entities(db.func.avg(Feedback.rating)).scalar()

    skills_offered = db.session.query(
        Skill.name, db.func.count(UserSkill.id).label("count")
    ).join(Skill, UserSkill.skill_id == Skill.id).filter(UserSkill.type == "offered").group_by(Skill.name).order_by(db.func.count(UserSkill.id).desc()).limit(20).all()

    data = {
        "total_users": total_users,
        "total_swaps": total_swaps,
        "pending_swaps": pending_swaps,
        "active_swaps": accepted_swaps,
        "completed_swaps": completed_swaps,
        "average_rating": round(float(avg_rating), 1) if avg_rating else None,
        "skill_summary": [{"skill": s, "count": c} for s, c in skills_offered],
    }
    
    _stats_cache["data"] = data
    _stats_cache["timestamp"] = now

    return jsonify(data), 200


@users_bp.route("/match/<user_id>", methods=["GET"])
@login_required
@limiter.limit("20 per hour")  # Protect Gemini free-tier quota (1500/day = 62.5/hr)
def get_match_score(user_id):
    from app.utils.gemini_match import compute_match

    if current_user.id == user_id:
        return jsonify({"error": "Cannot match with yourself"}), 422

    target = User.query.get(user_id)
    if not target or target.is_banned:
        return jsonify({"error": "User not found"}), 404

    result = compute_match(current_user.id, user_id)
    return jsonify({
        "score": result["score"],
        "reason": result["reason"],
        "cached": result["cached"],
    }), 200


@users_bp.route("/<user_id>/follow", methods=["POST"])
@login_required
def follow_user(user_id):
    if current_user.id == user_id:
        return jsonify({"error": "Cannot follow yourself"}), 422
        
    target = User.query.get(user_id)
    if not target or target.is_banned:
        return jsonify({"error": "User not found"}), 404
        
    existing = Follow.query.filter_by(follower_id=current_user.id, followed_id=user_id).first()
    if existing:
        return jsonify({"message": "Already following or requested"}), 200
        
    follow = Follow(follower_id=current_user.id, followed_id=user_id, status="pending")
    db.session.add(follow)
    db.session.commit()
    
    return jsonify({"message": f"Follow request sent to {target.name}"}), 201

@users_bp.route("/<user_id>/follow", methods=["DELETE"])
@login_required
def unfollow_user(user_id):
    existing = Follow.query.filter_by(follower_id=current_user.id, followed_id=user_id).first()
    if not existing:
        return jsonify({"error": "Not following this user"}), 404
        
    db.session.delete(existing)
    db.session.commit()
    
    return jsonify({"message": "Successfully unfollowed"}), 200

@users_bp.route("/follow-requests", methods=["GET"])
@login_required
def get_follow_requests():
    requests = Follow.query.filter_by(followed_id=current_user.id, status="pending").all()
    users = []
    for req in requests:
        user = User.query.get(req.follower_id)
        if user:
            users.append(user.to_dict(include_email=False))
    return jsonify({"requests": users}), 200

@users_bp.route("/<user_id>/accept-follow", methods=["POST"])
@login_required
def accept_follow(user_id):
    req = Follow.query.filter_by(follower_id=user_id, followed_id=current_user.id, status="pending").first()
    if not req:
        return jsonify({"error": "Follow request not found"}), 404
    req.status = "accepted"
    db.session.commit()
    return jsonify({"message": "Request accepted"}), 200

@users_bp.route("/<user_id>/reject-follow", methods=["POST"])
@login_required
def reject_follow(user_id):
    req = Follow.query.filter_by(follower_id=user_id, followed_id=current_user.id, status="pending").first()
    if not req:
        return jsonify({"error": "Follow request not found"}), 404
    db.session.delete(req)
    db.session.commit()
    return jsonify({"message": "Request rejected"}), 200

@users_bp.route("/<user_id>", methods=["GET"])
@login_required
def get_user(user_id):
    user = User.query.get(user_id)
    if not user or user.is_banned:
        return jsonify({"error": "User not found"}), 404

    offered = UserSkill.query.filter_by(user_id=user.id, type="offered").all()
    wanted = UserSkill.query.filter_by(user_id=user.id, type="wanted").all()
    # NOTE: Availability is intentionally excluded from the public profile to
    # prevent leaking personal schedule information. It is only exposed on
    # the authenticated /api/users/profile (self) endpoint.
    avg_rating = Feedback.query.with_entities(db.func.avg(Feedback.rating)).filter_by(rated_id=user.id).scalar()

    is_following_status = False
    if current_user.is_authenticated:
        follow_record = Follow.query.filter_by(follower_id=current_user.id, followed_id=user.id).first()
        if follow_record:
            is_following_status = follow_record.status

    result = user.to_dict(include_counts=True)
    result["is_following"] = is_following_status
    
    # PRIVACY: Only show private details if following is accepted, or if it's the user's own profile.
    if current_user.is_authenticated and (current_user.id == user.id or is_following_status == "accepted"):
        pass # keep email, dob, instagram_id
    else:
        result.pop("email", None)
        result.pop("dob", None)
        result.pop("instagram_id", None)

    result["skills_offered"] = [s.to_dict() for s in offered]
    result["skills_wanted"] = [s.to_dict() for s in wanted]
    result["average_rating"] = round(float(avg_rating), 1) if avg_rating else None
    return jsonify({"user": result}), 200
