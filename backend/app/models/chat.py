import uuid
from datetime import datetime, timezone
from app.extensions import db


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    swap_id = db.Column(db.String(36), db.ForeignKey("swap_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    # Nullable for server-generated system messages only — never accepted as null from client requests
    sender_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(db.Enum("user", "system", name="message_type"), default="user", nullable=False)
    is_read = db.Column(db.Boolean, default=False, server_default=db.text('false'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    swap = db.relationship("SwapRequest", back_populates="messages")
    sender = db.relationship("User", foreign_keys=[sender_id])

    def to_dict(self):
        return {
            "id": self.id,
            "swap_id": self.swap_id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else None,
            "sender_photo": self.sender.photo_url if self.sender else None,
            "content": self.content,
            "type": self.type,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }
