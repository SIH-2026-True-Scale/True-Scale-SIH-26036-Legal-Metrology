import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.database import supabase_admin

# auto_error=False so a MISSING token reaches our own check below and gets a
# 401 (not FastAPI's default 403 for HTTPBearer) — see get_current_user.
# Fixes Bug 3: 401/403 spec mismatch.
bearer_scheme = HTTPBearer(auto_error=False)

# Newer Supabase projects sign session JWTs asymmetrically (ES256) using keys
# published at this JWKS endpoint, rather than the legacy shared HS256 secret.
# Fetches/caches signing keys lazily and re-fetches on unknown key IDs.
_jwks_client = PyJWKClient(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json")


class CurrentUser:
    def __init__(self, id: str, role: str, jurisdiction_id: str | None, is_active: bool):
        self.id = id
        self.role = role
        self.jurisdiction_id = jurisdiction_id
        self.is_active = is_active


def decode_supabase_jwt(token: str) -> dict:
    """
    Verifies the Supabase Auth session JWT sent by the frontend
    (Authorization: Bearer <token>). Frontend gets this token directly from
    supabase-js after login/signup — this backend does NOT issue its own
    tokens (REQ-01 FR-1.10: Supabase Auth handles all of that).

    Fixes Bug 1 (Critical): this project signs with ES256 via JWKS, not the
    legacy HS256 shared secret, so plain HS256-only decoding rejected every
    valid token. We try JWKS/ES256 first (current Supabase default) and fall
    back to the legacy HS256 secret so this still works for older projects
    that haven't migrated to JWT signing keys.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWKClientError:
        # No JWKS available / key not found — likely a legacy HS256 project.
        try:
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired token: {e}",
            )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_supabase_jwt(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    # Role/jurisdiction are looked up from our own profiles table (not trusted
    # from the JWT itself), using the service-role client — this is a
    # deliberate, explicitly-scoped lookup by primary key, not a broad query.
    result = (
        supabase_admin.table("profiles")
        .select("id, role, jurisdiction_id, is_active")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="No profile found for this user")

    profile = result.data
    if not profile["is_active"]:
        raise HTTPException(status_code=403, detail="Account has been deactivated")

    return CurrentUser(
        id=profile["id"],
        role=profile["role"],
        jurisdiction_id=profile.get("jurisdiction_id"),
        is_active=profile["is_active"],
    )


def require_role(*allowed_roles: str):
    """Dependency factory: require_role('gatc', 'admin')"""

    def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted to perform this action",
            )
        return user

    return checker
