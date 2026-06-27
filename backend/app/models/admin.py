import uuid
from datetime import datetime, timezone
from flask_login import UserMixin
from app.extensions import db


class Admin(UserMixin, db.Model):
    __tablename__ = "admins"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="admin", nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self, **kwargs):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat(),
        }
