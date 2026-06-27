import uuid
from app.extensions import db


class UserSkill(db.Model):
    __tablename__ = "user_skills"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id = db.Column(db.String(36), db.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(db.Enum("offered", "wanted", name="user_skill_type"), nullable=False)
    proficiency = db.Column(db.Enum("beginner", "intermediate", "expert", name="proficiency_level"))

    user = db.relationship("User", back_populates="user_skills")
    skill = db.relationship("Skill", back_populates="user_skills")
    verified_badge = db.relationship("VerifiedBadge", back_populates="user_skill", uselist=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "skill_id": self.skill_id,
            "skill_name": self.skill.name if self.skill else None,
            "skill_category": self.skill.category if self.skill else None,
            "type": self.type,
            "proficiency": self.proficiency,
            "is_verified": self.verified_badge is not None,
            "verified_badge": self.verified_badge.to_dict() if self.verified_badge else None,
        }
