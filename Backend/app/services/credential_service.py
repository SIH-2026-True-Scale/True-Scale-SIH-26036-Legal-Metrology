import secrets
import string

from fastapi import HTTPException
from app.database import supabase_admin
from app.services.audit_service import log_action

# Which role is allowed to create which role — the one rule this whole
# module exists to enforce, per REQ-01 acceptance notes ("same underlying
# function, parameterized by role — not duplicated logic").
CREATOR_TO_TARGET_ROLE = {
    "gatc": "lmo",
    "admin": "gatc",
}


def generate_secure_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def create_role_account(
    creator_id: str,
    creator_role: str,
    email: str,
    jurisdiction_id: str,
) -> dict:
    """
    Shared implementation for:
      FR-1.4 — GATC creates an LMO account
      FR-1.6 — Admin creates a GATC account
    Target role is derived from the creator's role, never passed by the caller,
    so a GATC can never accidentally (or deliberately) create an Admin.
    """
    target_role = CREATOR_TO_TARGET_ROLE.get(creator_role)
    if target_role is None:
        raise HTTPException(
            status_code=403, detail=f"Role '{creator_role}' cannot create accounts"
        )

    password = generate_secure_password()

    # Supabase Admin API — service role key required, backend-only (FR-1.4).
    # user_metadata is read by the DB trigger (schema.sql) to set the correct
    # role/jurisdiction/created_by on the profiles row automatically.
    created = supabase_admin.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "role": target_role,
                "jurisdiction_id": jurisdiction_id,
                "created_by": creator_id,
            },
        }
    )

    new_user_id = created.user.id

    log_action(
        actor_user_id=creator_id,
        actor_role=creator_role,
        action="account.create",
        target_id=new_user_id,
        metadata={"target_role": target_role, "jurisdiction_id": jurisdiction_id},
    )

    return {
        "user_id": new_user_id,
        "email": email,
        "generated_password": password,
        "role": target_role,
        "jurisdiction_id": jurisdiction_id,
    }


def deactivate_account(
    actor_id: str,
    actor_role: str,
    actor_jurisdiction_id: str | None,
    target_user_id: str,
) -> dict:
    """Shared implementation for FR-1.5 (GATC deactivates LMO) and
    FR-1.7 (Admin deactivates GATC). Enforces jurisdiction match server-side —
    do not rely on RLS alone for this check (REQ-01 acceptance notes)."""

    target = (
        supabase_admin.table("profiles")
        .select("id, role, jurisdiction_id")
        .eq("id", target_user_id)
        .single()
        .execute()
        .data
    )
    if not target:
        raise HTTPException(status_code=404, detail="Target account not found")

    expected_target_role = CREATOR_TO_TARGET_ROLE.get(actor_role)
    if target["role"] != expected_target_role:
        raise HTTPException(
            status_code=403,
            detail=f"'{actor_role}' cannot deactivate a '{target['role']}' account",
        )

    if actor_role == "gatc" and target["jurisdiction_id"] != actor_jurisdiction_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot deactivate an account outside your jurisdiction",
        )

    supabase_admin.table("profiles").update({"is_active": False}).eq(
        "id", target_user_id
    ).execute()
    # Also disable login at the Supabase Auth level, not just our flag:
    supabase_admin.auth.admin.update_user_by_id(target_user_id, {"ban_duration": "876000h"})

    log_action(
        actor_user_id=actor_id,
        actor_role=actor_role,
        action="account.deactivate",
        target_id=target_user_id,
    )

    return {"user_id": target_user_id, "is_active": False}
