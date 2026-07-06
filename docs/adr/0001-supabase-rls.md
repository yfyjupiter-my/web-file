# ADR 0001 — Supabase Row-Level Security for the `files` table

Status: Accepted (documentation-ahead-of-implementation)
Date: 2026-07-06
Relates to: SEC-8, P3.6, `lib/supabase.ts`, `lib/files-repo.ts`

## Context

The app currently serves installer metadata from an in-memory mock repo
(`lib/files-repo.ts`). When Supabase is wired up, the server will hold a
**service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) that **bypasses RLS**. So RLS
is not the primary access control here — the site password gate + signed session
cookie (SEC-1) is. RLS is **defense-in-depth**:

- It contains the blast radius if the `anon`/`authenticated` keys are ever
  exposed to the browser (e.g. a future client-side Supabase call).
- It fails safe: a table with RLS enabled and no policy denies all access by
  default, so a misconfiguration errs toward "no data" rather than "all data".

## Decision

When the `files` table is created, **enable RLS and default-deny**. All
first-party access goes through the server using the service-role key (which
bypasses RLS by design). No anon/authenticated policy grants access, because the
browser never talks to Supabase directly in v1.

```sql
-- Metadata table (shape mirrors lib/types.ts InstallerFile).
create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null,
  category    text not null,
  version     text not null default '',
  size_label  text not null default '',
  notes       text,
  storage_key text not null,            -- derived from id, never from name (P3.1)
  uploaded_at timestamptz not null default now()
);

-- Case-insensitive uniqueness for the name-conflict check (P4.1).
create unique index if not exists files_name_lower_uniq
  on public.files (lower(name));

-- Defense-in-depth: enable RLS and grant NO policies to anon/authenticated.
alter table public.files enable row level security;
-- (Intentionally no CREATE POLICY: default-deny. The server's service-role
--  key bypasses RLS; the browser has no direct access in v1.)
```

Storage bucket: keep the installer bucket **private**; downloads are served via
short-lived signed URLs generated server-side (prd.md §4). Do not attach public
read policies to the bucket.

## Consequences

- If a future feature needs direct browser→Supabase reads, add a narrowly-scoped
  `authenticated` SELECT policy at that time — not preemptively.
- Anyone testing with the anon key against `files` will get zero rows, which is
  the intended fail-safe.
- Revisit alongside P4.1 (indexed conflict check) and P4.8 (client singleton)
  when the real integration lands.
