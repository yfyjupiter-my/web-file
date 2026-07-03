# Installer Vault

Password-protected installer file repository. See `prd.md` for product requirements
and `DESIGN.md` for the Sunset design system (tokens/components live in `app/globals.css`).

## Status

This is a UI-first scaffold: the password gate and dashboard screens are wired up and
navigable, but file data comes from `lib/mock-data.ts` and the upload API only logs/echoes
(`app/api/files/route.ts`). Supabase Storage/Postgres integration (`lib/supabase.ts`) is
stubbed and throws until `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are set.

## Getting started

```bash
cp .env.example .env.local   # set SITE_PASSWORD at minimum
npm install
npm run dev
```

Visit `http://localhost:3000`, enter the `SITE_PASSWORD` value, and you'll land on
`/dashboard`.

## What's real vs. stubbed

| Area | Status |
|---|---|
| Password gate (`/`, `/api/auth`, `middleware.ts`) | Real — env-var password + httpOnly cookie |
| Dashboard UI (tabs, search, view toggle, cards) | Real, backed by mock data |
| Upload drawer + replace-conflict toast | Real UI/state; `POST /api/files` is stubbed |
| File listing (`GET /api/files`) | Stubbed — returns `lib/mock-data.ts` |
| Supabase Storage/Postgres | Not wired — `lib/supabase.ts` throws until configured |

## Next steps

1. Create the Supabase project + `files` table + private storage bucket (prd.md §4).
2. Wire `GET/POST /api/files` to real Supabase queries instead of mock data.
3. Add signed-URL download flow.
4. Add delete-with-confirmation.
