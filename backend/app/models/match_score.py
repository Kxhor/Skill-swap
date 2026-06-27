import uuid
from datetime import datetime, timezone
from app.extensions import db


class MatchScore(db.Model):
    __tablename__ = "match_scores"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_a_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_b_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = db.Column(db.SmallInteger, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    computed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user_a = db.relationship("User", foreign_keys=[user_a_id])
    user_b = db.relationship("User", foreign_keys=[user_b_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_a_id": self.user_a_id,
            "user_b_id": self.user_b_id,
            "score": self.score,
            "reason": self.reason,
            "computed_at": self.computed_at.isoformat(),
        }
