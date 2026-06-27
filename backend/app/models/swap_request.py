import uuid
from datetime import datetime, timezone
from app.extensions import db


class SwapRequest(db.Model):
    __tablename__ = "swap_requests"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    offered_skill_id = db.Column(db.String(36), db.ForeignKey("user_skills.id", ondelete="CASCADE"), nullable=False)
    wanted_skill_id = db.Column(db.String(36), db.ForeignKey("user_skills.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(
        db.Enum("pending", "accepted", "rejected", "completed", "cancelled", name="swap_status"),
        default="pending",
        nullable=False,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    sender = db.relationship("User", foreign_keys=[sender_id], back_populates="sent_requests")
    receiver = db.relationship("User", foreign_keys=[receiver_id], back_populates="received_requests")
    offered_skill = db.relationship("UserSkill", foreign_keys=[offered_skill_id])
    wanted_skill = db.relationship("UserSkill", foreign_keys=[wanted_skill_id])
    messages = db.relationship("ChatMessage", back_populates="swap", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    feedback = db.relationship("Feedback", back_populates="swap")
    scheduled_session = db.relationship("ScheduledSession", back_populates="swap", uselist=False)

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "sender": self.sender.to_dict() if self.sender else None,
            "receiver": self.receiver.to_dict() if self.receiver else None,
            "offered_skill": self.offered_skill.to_dict() if self.offered_skill else None,
            "wanted_skill": self.wanted_skill.to_dict() if self.wanted_skill else None,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
