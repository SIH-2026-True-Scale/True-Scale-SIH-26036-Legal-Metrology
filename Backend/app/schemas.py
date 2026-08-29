from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr


# ---- Auth / accounts (REQ-01) ----

class LoginAuditRequest(BaseModel):
    """Frontend calls this right after a Supabase Auth login attempt
    (success or failure) so we get a server-side AuditLog entry — FR-1.9.
    This is an MVP stand-in for a Supabase Auth webhook; revisit later."""
    email: str
    success: bool
    reason: Optional[str] = None


class CreateAccountRequest(BaseModel):
    """Used for both FR-1.4 (GATC creates LMO) and FR-1.6 (Admin creates GATC) —
    same shape, the target role is inferred from the caller's role."""
    email: EmailStr
    jurisdiction_id: str


class CreateAccountResponse(BaseModel):
    user_id: str
    email: str
    generated_password: str  # shown once — see REQ-00 open decision on delivery
    role: str
    jurisdiction_id: str


class DeactivateResponse(BaseModel):
    user_id: str
    is_active: bool


# ---- Citizen module (REQ-02) ----

class ApplicationCreate(BaseModel):
    instrument_type: str
    business_details: dict[str, Any]
    photo_paths: list[str]  # Storage paths, uploaded client-side beforehand
    is_reverification: bool = False
    parent_application_id: Optional[str] = None


class ApplicationOut(BaseModel):
    id: str
    instrument_type: str
    business_details: dict[str, Any]
    photos: list[str]
    status: str
    is_reverification: bool
    parent_application_id: Optional[str] = None
    assigned_lmo_id: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    submitted_at: datetime


class CertificateOut(BaseModel):
    id: str
    application_id: str
    verifying_lmo_id: str
    verified_at: datetime
    qr_payload: str
    pdf_url: Optional[str] = None
