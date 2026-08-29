from supabase import create_client, Client
from app.config import settings

# Service-role client: full access, BYPASSES ROW LEVEL SECURITY ENTIRELY.
# Per REQ-00 rule 1 — every query made with this client MUST be manually
# scoped in application code (filter by citizen_id / jurisdiction_id /
# assigned_lmo_id as appropriate). Never expose this key to the frontend.
supabase_admin: Client = create_client(
    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
)
