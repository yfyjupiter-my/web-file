-- Migration 0004 — `categories` table.
-- Replaces the hardcoded taxonomy in lib/categories.ts with a persisted,
-- user-extensible list. Seeded with the original closed set so existing
-- `files.category` values keep resolving to a known category.
-- Idempotent: safe to re-run.

create table if not exists public.categories (
  name       text primary key,
  created_at timestamptz not null default now()
);

insert into public.categories (name) values
  ('OS / Drivers'),
  ('Productivity'),
  ('Security / AV'),
  ('Utilities'),
  ('Uncategorized')
on conflict (name) do nothing;

-- Defense-in-depth: RLS on, default-deny (no anon/authenticated policy). The
-- server's service-role key bypasses RLS by design (ADR 0001 / SEC-8).
alter table public.categories enable row level security;
