import uuid
from datetime import datetime, timezone
from app.extensions import db


class Skill(db.Model):
    __tablename__ = "skills"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    description = db.Column(db.Text)
    status = db.Column(db.Enum("pending", "approved", "rejected", name="skill_status"), default="pending", nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user_skills = db.relationship("UserSkill", back_populates="skill")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
