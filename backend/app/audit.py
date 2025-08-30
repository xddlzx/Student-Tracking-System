from sqlalchemy.orm import Session
from .models import AuditLog
from datetime import datetime, timezone

def audit(db: Session, *, actor_id, actor_role, action, entity_type, entity_id=None, before=None, after=None, ip=None, user_agent=None):
    row = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ts=datetime.now(timezone.utc),
        before=before,
        after=after,
        ip=ip,
        user_agent=user_agent
    )
    db.add(row)
    db.commit()
