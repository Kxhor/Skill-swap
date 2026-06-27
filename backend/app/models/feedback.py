import uuid
from datetime import datetime, timezone
from app.extensions import db


class Feedback(db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    swap_id = db.Column(db.String(36), db.ForeignKey("swap_requests.id", ondelete="CASCADE"), nullable=False)
    rater_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rated_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = db.Column(db.SmallInteger, nullable=False)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    swap = db.relationship("SwapRequest", back_populates="feedback")
    rater = db.relationship("User", foreign_keys=[rater_id], back_populates="feedback_given")
    rated = db.relationship("User", foreign_keys=[rated_id], back_populates="feedback_received")

    def to_dict(self):
        return {
            "id": self.id,
            "swap_id": self.swap_id,
            "rater_id": self.rater_id,
            "rated_id": self.rated_id,
            "rater_name": self.rater.name if self.rater else None,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
        }
