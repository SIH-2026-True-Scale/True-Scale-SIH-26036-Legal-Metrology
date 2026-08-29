from fastapi import APIRouter, Depends

from app.core.security import get_current_user, require_role, CurrentUser
from app.schemas import (
    LoginAuditRequest,
    CreateAccountRequest,
    CreateAccountResponse,
    DeactivateResponse,
)
from app.services.credential_service import create_role_account, deactivate_account
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["auth"])

# NOTE on FR-1.1 / FR-1.2 (citizen signup & login):
# These do NOT have backend endpoints. Supabase Auth is designed for the
# frontend to call directly via supabase-js (`supabase.auth.signUp`,
# `supabase.auth.signInWithPassword`). The DB trigger in schema.sql creates
# the profile row automatically on signup. This backend only ever verifies
# the resulting session JWT (see app/core/security.py) — it never issues
# its own tokens. Tell your frontend dev to hit Supabase directly for these two.


@router.post("/log-login-attempt")
def log_login_attempt(payload: LoginAuditRequest):
    """
    FR-1.9: every login attempt (success/failure) gets an AuditLog entry.
    MVP approach — frontend calls this immediately after calling Supabase Auth
    login, success or failure. A Supabase Auth webhook is the more robust
    long-term approach; this unblocks tonight without needing webhook config.
    """
    log_action(
        actor_user_id=None,  # we don't have a verified session yet on failure
        actor_role=None,
        action="login",
        metadata={"email": payload.email, "success": payload.success, "reason": payload.reason},
    )
    return {"logged": True}


@router.post("/accounts", response_model=CreateAccountResponse)
def create_account(
    payload: CreateAccountRequest,
    user: CurrentUser = Depends(require_role("gatc", "admin")),
):
    """
    FR-1.4: GATC creates an LMO account.
    FR-1.6: Admin creates a GATC account.
    Same endpoint, same underlying service — target role is derived from the
    caller's own role (see credential_service.CREATOR_TO_TARGET_ROLE).
    """
    result = create_role_account(
        creator_id=user.id,
        creator_role=user.role,
        email=payload.email,
        jurisdiction_id=payload.jurisdiction_id,
    )
    return result


@router.patch("/accounts/{target_user_id}/deactivate", response_model=DeactivateResponse)
def deactivate(
    target_user_id: str,
    user: CurrentUser = Depends(require_role("gatc", "admin")),
):
    """FR-1.5 (GATC deactivates LMO) / FR-1.7 (Admin deactivates GATC)."""
    result = deactivate_account(
        actor_id=user.id,
        actor_role=user.role,
        actor_jurisdiction_id=user.jurisdiction_id,
        target_user_id=target_user_id,
    )
    return result


@router.get("/me")
def whoami(user: CurrentUser = Depends(get_current_user)):
    """Handy for the frontend dev to sanity-check a token is being read correctly."""
    return {"id": user.id, "role": user.role, "jurisdiction_id": user.jurisdiction_id}
