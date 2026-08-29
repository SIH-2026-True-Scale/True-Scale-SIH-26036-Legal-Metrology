from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_role, CurrentUser
from app.database import supabase_admin
from app.schemas import ApplicationCreate, ApplicationOut, CertificateOut
from app.services.audit_service import log_action

router = APIRouter(prefix="/applications", tags=["citizen"])

# NOTE on photo uploads (FR-2.1, acceptance notes):
# Photos are uploaded CLIENT-SIDE directly to the private 'application-photos'
# Supabase Storage bucket (frontend uses supabase-js with the citizen's own
# session — the Storage RLS policy in schema.sql already scopes this to
# `{citizen_id}/...` folders). This endpoint only ever receives the resulting
# storage paths, never raw file bytes — keeps Render stateless and avoids
# handling large multipart uploads on a free-tier instance.


@router.post("", response_model=ApplicationOut)
def submit_application(
    payload: ApplicationCreate,
    user: CurrentUser = Depends(require_role("citizen")),
):
    """FR-2.1 / FR-2.2: submit a new application, optionally as a re-verification."""
    row = {
        "citizen_id": user.id,
        "instrument_type": payload.instrument_type,
        "business_details": payload.business_details,
        "photos": payload.photo_paths,
        "status": "Pending",
        "is_reverification": payload.is_reverification,
        "parent_application_id": payload.parent_application_id,
    }
    result = supabase_admin.table("applications").insert(row).execute()
    created = result.data[0]

    log_action(
        actor_user_id=user.id,
        actor_role=user.role,
        action="application.submit",
        target_id=created["id"],
    )
    return created


@router.get("/me", response_model=list[ApplicationOut])
def list_my_applications(user: CurrentUser = Depends(require_role("citizen"))):
    """
    FR-2.3 / FR-2.5: only the logged-in citizen's own applications.
    Explicitly filtered by citizen_id even though this call uses the
    service-role client (which bypasses RLS) — REQ-00 rule 1.
    """
    result = (
        supabase_admin.table("applications")
        .select("*")
        .eq("citizen_id", user.id)
        .order("submitted_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{application_id}/certificate", response_model=CertificateOut)
def get_certificate(
    application_id: str,
    user: CurrentUser = Depends(require_role("citizen")),
):
    """FR-2.4: view the certificate for one of the citizen's own Verified applications."""
    app_row = (
        supabase_admin.table("applications")
        .select("id, citizen_id, status")
        .eq("id", application_id)
        .single()
        .execute()
        .data
    )
    if not app_row or app_row["citizen_id"] != user.id:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_row["status"] != "Verified":
        raise HTTPException(status_code=409, detail="Application is not yet Verified")

    cert = (
        supabase_admin.table("certificates")
        .select("*")
        .eq("application_id", application_id)
        .single()
        .execute()
        .data
    )
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not generated yet")
    return cert
