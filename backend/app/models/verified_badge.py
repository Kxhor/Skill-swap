import uuid
from datetime import datetime, timezone
from app.extensions import db


class VerifiedBadge(db.Model):
    __tablename__ = "verified_badges"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_skill_id = db.Column(db.String(36), db.ForeignKey("user_skills.id", ondelete="CASCADE"), unique=True, nullable=False)
    verified_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    verification_count = db.Column(db.SmallInteger, default=3, nullable=False)

    user_skill = db.relationship("UserSkill", back_populates="verified_badge")

    def to_dict(self):
        return {
            "id": self.id,
            "user_skill_id": self.user_skill_id,
            "verified_at": self.verified_at.isoformat(),
            "verification_count": self.verification_count,
        }
