import os
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf.csrf import generate_csrf
from app.extensions import db, bcrypt
from app.models.user import User
from app.models.admin import Admin
from app.utils.validators import validate_email, validate_password, validate_name, validate_location

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/csrf-token", methods=["GET"])
def get_csrf_token():
    token = generate_csrf()
    resp = jsonify({"csrf_token": token})
    resp.set_cookie(
        "csrf_token",
        token,
        max_age=3600,
        secure=os.environ.get("FLASK_ENV") == "production",
        samesite="None" if os.environ.get("FLASK_ENV") == "production" else "Lax",
        httponly=False,
    )
    return resp


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    location = data.get("location", "").strip()

    errors = []
    is_valid, msg = validate_name(name)
    if not is_valid:
        errors.append(msg)
    is_valid, msg = validate_email(email)
    if not is_valid:
        errors.append(msg)
    else:
        if User.query.filter_by(email=email).first():
            errors.append("Email already registered")
    is_valid, msg = validate_password(password)
    if not is_valid:
        errors.append(msg)
    if location:
        is_valid, msg = validate_location(location)
        if not is_valid:
            errors.append(msg)

    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 422

    user = User(
        name=name,
        email=email,
        password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
        location=location or None,
    )
    db.session.add(user)
    db.session.commit()

    login_user(user)
    return jsonify({"message": "Registration successful", "user": user.to_dict(include_email=True)}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 422

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    if user.is_banned:
        return jsonify({"error": "Your account has been banned. Contact support."}), 403

    login_user(user)
    return jsonify({"message": "Login successful", "user": user.to_dict(include_email=True)}), 200


@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 422

    admin = Admin.query.filter_by(email=email).first()
    if not admin or not bcrypt.check_password_hash(admin.password_hash, password):
        return jsonify({"error": "Invalid admin credentials"}), 401

    login_user(admin)
    return jsonify({"message": "Admin login successful", "admin": admin.to_dict()}), 200


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    if hasattr(current_user, "role"):
        return jsonify({"admin": current_user.to_dict()}), 200
    return jsonify({"user": current_user.to_dict(include_email=True)}), 200
