import uuid
from datetime import datetime, timezone
from app.extensions import db
from flask_login import UserMixin
from .follow import Follow


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(100))
    photo_url = db.Column(db.String(500))
    bio = db.Column(db.Text)
    is_banned = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # New fields
    linkedin_id = db.Column(db.String(150))
    github_id = db.Column(db.String(150))
    instagram_id = db.Column(db.String(150))
    dob = db.Column(db.String(50))
    swap_id = db.Column(db.String(50), unique=True)
    swap_username = db.Column(db.String(50), unique=True)

    # Relationships
    user_skills = db.relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    sent_requests = db.relationship("SwapRequest", foreign_keys="SwapRequest.sender_id", back_populates="sender")
    received_requests = db.relationship("SwapRequest", foreign_keys="SwapRequest.receiver_id", back_populates="receiver")
    availability = db.relationship("Availability", back_populates="user", cascade="all, delete-orphan")
    feedback_given = db.relationship("Feedback", foreign_keys="Feedback.rater_id", back_populates="rater")
    feedback_received = db.relationship("Feedback", foreign_keys="Feedback.rated_id", back_populates="rated")

    followed = db.relationship(
        "Follow",
        foreign_keys=[Follow.follower_id],
        backref=db.backref("follower", lazy="joined"),
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    followers = db.relationship(
        "Follow",
        foreign_keys=[Follow.followed_id],
        backref=db.backref("followed", lazy="joined"),
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    @property
    def is_active(self):
        return not self.is_banned

    def to_dict(self, include_email=False, include_counts=False):
        data = {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "photo_url": self.photo_url,
            "bio": self.bio,
            "is_banned": self.is_banned,
            "created_at": self.created_at.isoformat(),
            "linkedin_id": self.linkedin_id,
            "github_id": self.github_id,
            "instagram_id": self.instagram_id,
            "dob": self.dob,
            "swap_id": self.swap_id,
            "swap_username": self.swap_username,
        }
        if include_email:
            data["email"] = self.email
        if include_counts:
            data["followers_count"] = self.followers.count()
            data["following_count"] = self.followed.count()
        return data

