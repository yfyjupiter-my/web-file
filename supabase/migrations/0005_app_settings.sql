-- Migration 0002 — `app_settings` key/value table.
-- Backs a persisted override of the site password (lib/settings-repo.ts) so a
-- password change survives restarts/redeploys without touching SITE_PASSWORD.
-- Idempotent: safe to re-run.

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Defense-in-depth: RLS on, default-deny (no anon/authenticated policy). The
-- server's service-role key bypasses RLS by design (ADR 0001 / SEC-8) — the
-- same posture as `files`.
alter table public.app_settings enable row level security;
