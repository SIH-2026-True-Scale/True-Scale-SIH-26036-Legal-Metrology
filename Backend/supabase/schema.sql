-- ============================================================================
-- SIH 26036 — Core schema, RLS policies, and auth trigger
-- Implements: REQ-00 (shared core), REQ-01 (auth), REQ-02 (citizen module)
-- Run this in Supabase SQL Editor (project you were invited to).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (extends auth.users — REQ-00 "User" entity)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('citizen','lmo','gatc','admin')),
  jurisdiction_id uuid null,          -- null for citizen/admin, set for lmo/gatc
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)  -- null for self-signup / seeded admin
);

alter table public.profiles enable row level security;

-- A user can always read their own profile row (needed so the backend/frontend
-- can determine "who am I" after login).
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

-- GATC can see LMO profiles in their own jurisdiction (REQ-00 rule 2 scoping).
create policy "profiles_gatc_scoped_select" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'gatc'
    )
    and role = 'lmo'
    and jurisdiction_id = (select jurisdiction_id from public.profiles where id = auth.uid())
  );

-- Admin sees everything.
create policy "profiles_admin_select" on public.profiles
  for select using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );

-- NOTE: profiles are only ever INSERTed by the trigger below or by the Render
-- backend using the service role key (which bypasses RLS entirely — see
-- REQ-00 rule 1). No client-side insert policy is defined on purpose.


-- ----------------------------------------------------------------------------
-- 2. Auth trigger — auto-create a profile row on every new auth.users insert
--    (FR-1.1 decision: trigger, not a second backend call)
--
--    Public citizen signup (Supabase Auth sign_up from the frontend) has no
--    metadata, so it defaults to role='citizen'.
--    Backend-created LMO/GATC accounts (FR-1.4/1.6) pass role/jurisdiction_id/
--    created_by via `user_metadata` on the Admin API createUser call, and the
--    trigger reads that instead of defaulting.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, jurisdiction_id, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'citizen'),
    nullif(new.raw_user_meta_data->>'jurisdiction_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'created_by', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ----------------------------------------------------------------------------
-- 3. APPLICATIONS  (REQ-00 / REQ-02)
-- ----------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references auth.users(id),
  instrument_type text not null,
  business_details jsonb not null default '{}'::jsonb,
  photos text[] not null default '{}',              -- Supabase Storage paths
  status text not null default 'Pending'
    check (status in ('Pending','Scheduled','Verified','Rejected')),
  is_reverification boolean not null default false,
  parent_application_id uuid null references public.applications(id),
  assigned_lmo_id uuid null references auth.users(id),
  jurisdiction_id uuid null,
  scheduled_date timestamptz null,
  submitted_at timestamptz not null default now()
);

alter table public.applications enable row level security;

-- FR-2.3 / FR-2.5: citizen sees only their own applications.
create policy "applications_citizen_select_own" on public.applications
  for select using (citizen_id = auth.uid());

create policy "applications_citizen_insert_own" on public.applications
  for insert with check (citizen_id = auth.uid());

-- LMO sees applications assigned to them (REQ-00 rule 2 scoping).
create policy "applications_lmo_scoped_select" on public.applications
  for select using (assigned_lmo_id = auth.uid());

-- GATC sees applications in their own jurisdiction.
create policy "applications_gatc_scoped_select" on public.applications
  for select using (
    jurisdiction_id = (select jurisdiction_id from public.profiles where id = auth.uid())
  );

-- Admin: no scope filter.
create policy "applications_admin_select" on public.applications
  for select using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );


-- ----------------------------------------------------------------------------
-- 4. CERTIFICATES  (REQ-00 — full field-level decisions land in REQ-06)
-- ----------------------------------------------------------------------------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id),
  citizen_id uuid not null references auth.users(id),
  verifying_lmo_id uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  qr_payload text not null,      -- placeholder format until REQ-06 finalizes it
  pdf_url text null              -- Supabase Storage path, once REQ-06 decides PDF vs HTML
);

alter table public.certificates enable row level security;

create policy "certificates_citizen_select_own" on public.certificates
  for select using (citizen_id = auth.uid());

create policy "certificates_admin_select" on public.certificates
  for select using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );


-- ----------------------------------------------------------------------------
-- 5. AUDIT LOG  (append-only — no update/delete route, ever)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id),
  actor_role text null,
  action text not null,
  target_id uuid null,
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.audit_logs enable row level security;

-- Only Admin can read audit logs (GATC read-only "log history" in REQ-04 is
-- scoped differently and will use a separate policy once that req lands —
-- do not widen this policy without an explicit requirement).
create policy "audit_logs_admin_select" on public.audit_logs
  for select using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );
-- No insert/select/update/delete policy for anyone else. The Render backend
-- writes rows using the service role key (bypasses RLS by design — REQ-00 rule 1).


-- ----------------------------------------------------------------------------
-- 6. STORAGE — private bucket for application photos (REQ-02 acceptance notes)
--    Run this after creating the 'application-photos' bucket in the dashboard
--    (Storage > New bucket > name: application-photos > Public: OFF).
-- ----------------------------------------------------------------------------
create policy "photo_upload_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'application-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photo_read_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'application-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 7. SEEDED ADMIN (FR-1.8) — manual, one-time
--    1. Create the admin user via Supabase Dashboard > Authentication > Add user
--       (NOT via any API route — no code path may create an Admin).
--    2. The trigger above will insert a profile row defaulting to role='citizen'
--       since dashboard-created users have no custom metadata. Run this once,
--       replacing the UUID with the new user's id (visible in the dashboard):
--
--    update public.profiles set role = 'admin' where id = '<paste-uuid-here>';
-- ----------------------------------------------------------------------------
