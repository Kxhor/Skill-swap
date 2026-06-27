import uuid
from datetime import datetime, timezone
from app.extensions import db


class ScheduledSession(db.Model):
    __tablename__ = "scheduled_sessions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    swap_id = db.Column(db.String(36), db.ForeignKey("swap_requests.id", ondelete="CASCADE"), unique=True, nullable=False)
    # proposer_id tracks who proposed the slot (the other party confirms)
    proposer_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scheduled_at = db.Column(db.DateTime, nullable=False)
    calendar_link = db.Column(db.String(500))
    status = db.Column(
        db.Enum("proposed", "confirmed", "completed", name="session_status"),
        default="proposed",
        nullable=False,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    swap = db.relationship("SwapRequest", back_populates="scheduled_session")
    proposer = db.relationship("User", foreign_keys=[proposer_id])

    def to_dict(self):
        return {
            "id": self.id,
            "swap_id": self.swap_id,
            "proposer_id": self.proposer_id,
            "scheduled_at": self.scheduled_at.isoformat(),
            "calendar_link": self.calendar_link,
            "status": self.status,
        }
