-- Migration 0001 — `files` metadata table.
-- Shape mirrors lib/types.ts `InstallerFile`; see docs/adr/0001-supabase-rls.md.
-- Idempotent: safe to re-run.

create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null,
  category    text not null,
  version     text not null default '',
  size_label  text not null default '',
  notes       text,
  storage_key text not null,             -- derived from id, never from name (P3.1)
  uploaded_at timestamptz not null default now(),
  -- Stored, lower-cased name so the conflict check (P4.1) is an indexed exact
  -- match via PostgREST (`name_lower=eq.<lower>`) — a functional index on
  -- lower(name) can't be expressed through PostgREST filters.
  name_lower  text generated always as (lower(name)) stored
);

-- Case-insensitive uniqueness + the index the conflict check rides on (P4.1).
create unique index if not exists files_name_lower_uniq
  on public.files (name_lower);

-- Supports the newest-first paginated list (P4.2) without a full sort.
create index if not exists files_uploaded_at_idx
  on public.files (uploaded_at desc);

-- Defense-in-depth: RLS on, default-deny (no anon/authenticated policy). The
-- server's service-role key bypasses RLS by design (ADR 0001 / SEC-8).
alter table public.files enable row level security;
