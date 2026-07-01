from datetime import datetime, timezone
from app.extensions import db

class Follow(db.Model):
    __tablename__ = "follows"

    follower_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    followed_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status = db.Column(db.Enum("pending", "accepted", name="follow_status"), default="pending", server_default=db.text("'pending'"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
