# SIH 26036 — Backend

Covers **REQ-00 (shared core), REQ-01 (auth), REQ-02 (citizen module)**.
LMO/GATC/Admin/Certificate generation are stubbed — not yet built because
REQ-03 through REQ-06 haven't been provided yet. Do not let the frontend dev
build against guessed shapes for those; wait for the actual req docs.

## Assumptions made (open decisions from REQ-00, picked so work could start tonight — revisit before final submission)

| Open decision | Choice made here | Why |
|---|---|---|
| Citizen signup/login flow | Frontend calls Supabase Auth **directly** (no backend endpoint) | That's what Supabase Auth is for — backend only verifies the resulting JWT |
| FR-1.1 profile creation | DB trigger on `auth.users`, not a second backend call | One less network round-trip, can't be forgotten |
| FR-1.9 login audit logging | Frontend calls `POST /auth/log-login-attempt` right after Supabase login | Unblocks tonight; a Supabase Auth webhook is the more correct long-term fix |
| Photo upload | Frontend uploads directly to Supabase Storage, backend only stores the resulting paths | Keeps Render stateless, avoids handling large file bytes on a free instance |
| QR payload / certificate format | Left as a placeholder `qr_payload` text column | REQ-06 hasn't landed yet — do not build the QR/PDF generator against this guess |
| Credential delivery (shown-once vs email) | Returned once in the API response | REQ-06/REQ-01 open decision — email delivery can be added later without changing the DB shape |

## 1. Run the SQL schema

Open your Supabase project (ask your teammate to invite you as Editor first if you haven't been) → SQL Editor → paste and run `supabase/schema.sql`.

Then also manually create the storage bucket:
`Storage → New bucket → name: application-photos → Public: OFF`

Then create the seeded Admin account per the instructions at the bottom of `schema.sql` (Dashboard → Authentication → Add user, then one SQL `update` to set its role).

## 2. Local setup

```bash
cd sih-backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# now edit .env with your real Supabase project values
# (Project Settings > API for URL/anon/service keys, > JWT Settings for the JWT secret)
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` — this is the live, clickable API contract.
**Send this URL (once deployed) to your frontend dev — they can see every
endpoint's exact request/response shape without you explaining anything.**

## 3. Push and deploy

```bash
git add .
git commit -m "Backend scaffold: REQ-00/01/02"
git push origin <your-branch>
```

On Render: New → Web Service → connect the GitHub org repo → it should pick up
`render.yaml` automatically. Fill in the env vars in the Render dashboard
(same values as your local `.env`) — `sync: false` means Render won't try to
guess them, you must paste them in yourself.

## 4. Sanity-test before telling the frontend dev it's ready

- `GET /` → should return `{"status": "ok"}`
- Sign up a citizen via Supabase Auth directly (frontend or Supabase's own
  test UI), then call `GET /auth/me` with that user's JWT → should show
  `role: citizen`
- `POST /applications` as that citizen → should create a row
- `GET /applications/me` as that citizen → should return only their own row
- Try hitting `/applications/me` with no token, and with a different citizen's
  token → both should fail appropriately

## If something's broken and you don't know why

This scaffold was written without being executed against a real Supabase
project (no internet access in the environment that generated it) — treat it
as a strong first draft, not guaranteed-working code. Claude Code can actually
run this, install the dependencies, hit real errors, and fix them live against
your actual Supabase project — that's the fastest path from here to "the
frontend dev can build on this."
