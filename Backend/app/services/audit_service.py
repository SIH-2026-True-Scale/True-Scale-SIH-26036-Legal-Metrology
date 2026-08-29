from typing import Optional
from app.database import supabase_admin


def log_action(
    actor_user_id: Optional[str],
    actor_role: Optional[str],
    action: str,
    target_id: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """
    Single shared writer for the append-only AuditLog table (REQ-00 rule 3).
    Every state-changing endpoint calls this directly — do not let individual
    features skip it. No update/delete path exists for this table on purpose.
    """
    supabase_admin.table("audit_logs").insert(
        {
            "actor_user_id": actor_user_id,
            "actor_role": actor_role,
            "action": action,
            "target_id": target_id,
            "metadata": metadata or {},
        }
    ).execute()
