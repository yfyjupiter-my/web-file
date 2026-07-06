# Installer Vault

Password-protected installer file repository. See `prd.md` for product requirements
and `DESIGN.md` for the Sunset design system (tokens/components live in `app/globals.css`).

## Status

The password gate, dashboard, and the full upload/download flow are wired to Supabase.
When `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, the app reads/writes the real
`files` table and stores binaries in a private Storage bucket; without them it falls back
to the in-memory `lib/mock-data.ts` so the UI still runs (uploads/downloads are disabled in
that mode). The data-source seam is `getFilesRepo()` in `lib/files-repo.ts`.

## Getting started

```bash
cp .env.example .env.local   # set SITE_PASSWORD + COOKIE_SECRET at minimum
npm install
npm run dev                  # mock mode if Supabase vars are unset
```

Visit `http://localhost:3000`, enter the `SITE_PASSWORD` value, and you'll land on
`/dashboard`.

### Wiring up Supabase (real files)

1. Set `SUPABASE_URL` (the `https://<ref>.supabase.co` API URL — **not** a Postgres
   connection string), `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` (pooler
   connection string, used only by migrations) in `.env.local`.
2. `npm run migrate` — creates the `files` table, indexes, and RLS (`supabase/migrations/`).
3. `npm run setup:storage` — creates the private `installers` bucket.

> **Upload size:** capped by the Supabase project's global Storage limit (50MB on the free
> tier). To support larger installers, raise that limit on a paid plan and bump
> `MAX_UPLOAD_MB` in `lib/validation.ts`.

## What's real vs. stubbed

| Area | Status |
|---|---|
| Password gate (`/`, `/api/auth`, `middleware.ts`) | Real — env-var password + signed httpOnly cookie |
| Dashboard UI (tabs, search, view toggle, cards) | Real |
| File listing (`GET /api/files`) | Real — paginated, indexed (Supabase); mock fallback |
| Upload (`/api/files/upload-url` → direct-to-Storage PUT → `POST /api/files`) | Real — client-direct upload, server-verified size/type |
| Download (`GET /api/files/[id]/download`) | Real — 302 to a short-lived signed URL |
| Supabase Storage/Postgres | Wired — service-role client, private bucket, RLS default-deny |

## Next steps

1. Add delete-with-confirmation (repo `delete()` + Storage object removal).
2. Grid virtualization once file counts grow (TASKS.md P4.7).
3. Optional: upload progress UI for large files; per-user auth (prd.md v2.0).
