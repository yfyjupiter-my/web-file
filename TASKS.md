# Installer Vault — Remediation Tasks

_Derived from `SEC-AUDIT.md`, `CODE-AUDIT.md`, `RUN-AUDIT.md` (all dated 2026-07-03, HEAD `be3fac1`)._

Tasks are grouped into phases ordered by **dependency and risk**. Each task lists the source
audit finding(s) and severity. Do phases roughly in order — later phases assume the abstractions
and guardrails from earlier ones exist.

Legend: `[SEC-n]` Security, `[CODE-n]` Code/Architecture, `[RUN-n]` Runtime/Performance.

---

## Phase 0 — Tooling & guardrails (do first) — ✅ DONE (2026-07-03)

Set up the safety net so later refactors can't silently regress.

- [x] **P0.1 — Add `typecheck` script.** `"typecheck": "tsc --noEmit"` in `package.json`. Passes clean. `[CODE-95]` Low
- [x] **P0.2 — Commit an ESLint config.** Added `.eslintrc.json` extending `next/core-web-vitals` with a TS-aware `@typescript-eslint/no-unused-vars` override (explicit parser+plugin, since this `eslint-config-next` version doesn't register the plugin at top level). It immediately caught the dead `totalSize` var (CODE-60), which was removed to keep lint green. `[CODE-96]` Medium
- [x] **P0.3 — Add test tooling.** Installed Vitest; added `vitest.config.ts` (node env, `@/` alias) and `lib/auth.test.ts` — 7 passing tests covering `checkPassword` (correct/incorrect/length-oracle/unset) and `isAuthenticated` (mocked cookies). Scripts: `test`, `test:watch`. _Playwright e2e deferred_ — needs browser binaries + a running server; add when the real data flow exists. `[CODE-94]` Medium
- [x] **P0.4 — Add CI dependency scanning.** Added `.github/workflows/ci.yml` (verify job: typecheck→lint→test→build; separate `audit` job: `npm audit --audit-level=high`) and `.github/dependabot.yml` (weekly npm + actions updates). `[SEC-9]` Informational

> ⚠️ **The `audit` CI job is currently RED.** `npm audit` reports 5 high / 1 critical advisories (`next`, `glob` via eslint-config-next, `esbuild`/`vite` via vitest). All fixes require **major** version bumps (e.g. `next@16`) — a breaking-change decision out of Phase 0 scope. Track as a dependency-upgrade task under Phase 3. The `verify` job (typecheck/lint/test/build) is green.

---

## Phase 1 — Critical security (block before any real files) — ✅ DONE (2026-07-03)

- [x] **P1.1 — Replace the forgeable session cookie.** Signed tokens now live in `lib/session.ts`: `<payload>.<sig>` where payload is base64url `{ sid, exp }` and sig is HMAC-SHA256 over it, keyed by a server-only `COOKIE_SECRET`. `createSessionToken()`/`verifySessionToken()` use the **Web Crypto API** (`crypto.subtle`) so the identical code runs in both the Edge runtime (`middleware.ts`) and Node (`isAuthenticated()`, now async). Verify fails closed on tamper/expiry/wrong-secret/missing-secret. The legacy `"1"` value no longer authenticates (regression-tested). `COOKIE_SECRET` added to `.env.example` + `.env.local`. `[SEC-1]` **Critical**
- [x] **P1.2 — Rate-limit `/api/auth`.** `lib/rate-limit.ts` throttles per client key (`x-forwarded-for` → `x-real-ip` → `unknown`): 5 free failures, then exponential backoff (1s doubling, capped 15 min), cleared on success. Structured `console.warn` alert past a threshold (never logs the password); idle-eviction + `MAX_KEYS` cap bound memory. **In-memory / per-instance** — documented swap path to Upstash / Vercel KV before horizontal scale-out. `[SEC-2]` High

> ℹ️ Rate limiting is intentionally **in-memory** (no external infra added in Phase 1). It protects local/dev and single-instance deploys; the `check/record/success` surface is a drop-in for a KV-backed store when the app scales out.

---

## Phase 2 — Data-access architecture refactor — ✅ DONE (2026-07-06)

The single biggest layering problem: the dashboard bypasses the API and reads mock data directly.
Fix the seam before Supabase is wired in.

- [x] **P2.1 — Introduce a `lib/files-repo.ts` abstraction.** Added a typed `FilesRepo` interface (`list`/`findByName`/`create`) with an in-memory `MockFilesRepo` seeded from `mock-data.ts`, exposed via a `getFilesRepo()` singleton (so POST writes are visible to later GETs in-process). Returns defensive copies; never mutates the fixture array. Swapping to Supabase is a change to `getFilesRepo()`, not callers. Covered by `lib/files-repo.test.ts`. `[CODE-cross#2]` `[RUN-8]` High
- [x] **P2.2 — Split `lib/mock-data.ts`.** Permanent taxonomy → `lib/categories.ts` (`categories`, `isCategory()` guard, `Tab` type derived from `Category`); `lib/mock-data.ts` now holds only deletable fixtures. Updated consumers (`StatStrip`, `UploadDrawer`, dashboard, API route). `[CODE-78]` High
- [x] **P2.3 — Dashboard fetches through the API/repo, not `mockFiles`.** `app/dashboard/page.tsx` now reads via `getFilesRepo()` — the same repo backing `/api/files` — as the single source of truth. No more `mockFiles` import in the page. `[CODE-cross#1]` High / `[RUN-2]`
- [x] **P2.4 — Convert dashboard to a Server Component + client island.** Page is now an async Server Component (`force-dynamic`) that fetches server-side and renders `TopNav`/`StatStrip`; interactive bits (tabs, search, view toggle, drawer, conflict) moved to `app/dashboard/DashboardControls.tsx`. Dashboard client JS dropped to ~1.93 kB. `[RUN-1]` High
- [x] **P2.5 — Add API contract types to `lib/types.ts`.** Added `AuthResponse`, `UploadPayload`, `FilesListResponse`, `UploadResponse`. Route handlers use `NextResponse.json<T>` and client fetches (`app/page.tsx`, `UploadDrawer`) are typed. `[CODE-87]` Medium
- [x] **P2.6 — Extract shared helpers.** `lib/api-helpers.ts`: `withAuth(handler)` HOF replacing the duplicated `isAuthenticated()` guard, plus `parseJsonBody()`. Name-conflict check centralized in `repo.findByName()`. `[CODE-cross#4]` Medium
- [x] **P2.7 — Make the upload flow observable.** `POST /api/files` now persists via `repo.create()` and returns the stored row; the drawer's `onSaved` calls `router.refresh()` so the new file appears in the server-rendered grid. `[CODE-cross#3]` Medium
- [x] **P2.8 — Add `import "server-only"` guards.** Added to `lib/supabase.ts`, `lib/auth.ts`, `lib/files-repo.ts`, `lib/api-helpers.ts`. Vitest aliases `server-only` → `test/stubs/server-only.ts` (no bundler boundary under test). `[SEC-8]` `[CODE-74]` Low

> ℹ️ The mock repo is **in-memory / per-process** — uploads persist only until the server restarts and aren't shared across instances. This is the demo seam; the `FilesRepo` interface is the drop-in point for a durable `SupabaseFilesRepo` (Phase 4 pairs with the real integration). Server-side upload validation is currently light (name + `isCategory`); full hardening is **P3.1**.

---

## Phase 3 — Security hardening

- [ ] **P3.1 — Server-side upload validation.** Validate `category` against the `Category` union; restrict `name`/`version` charset + max length; cap `notes`; derive storage keys from a generated UUID, never user-supplied `name` (prevents future path traversal). `[SEC-6]` `[CODE-40]` Medium
- [ ] **P3.2 — Security headers.** Add `headers()` in `next.config.js` (or middleware): `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. `[SEC-5]` Medium
- [ ] **P3.3 — CSRF defense-in-depth.** Validate `Origin` / `Sec-Fetch-Site` on all mutating routes (in addition to SameSite=Lax). `[SEC-4]` Medium
- [ ] **P3.4 — Harden example env.** Change `SITE_PASSWORD=changeme` → `REPLACE_ME_BEFORE_DEPLOY`; add a boot-time check that warns/refuses if the placeholder is still set. `[SEC-3]` Medium
- [ ] **P3.5 — Remove raw-body logging.** Drop / gate `console.log("[stub] would upload installer:", body)` behind a debug flag; never log unredacted `notes`. `[SEC-7]` `[RUN-9]` Low
- [ ] **P3.6 — Document/enforce Supabase RLS.** Add RLS policies on the `files` table as defense-in-depth for when the service-role key path is wired up. `[SEC-8]` Low

---

## Phase 4 — Performance & scale prep

Most are "correct at current 8-item scale" — do them as/just before Supabase and larger datasets land.

- [ ] **P4.1 — Replace fetch-then-scan conflict check.** When wiring Supabase, use an indexed query (`select id from files where lower(name)=lower($1) limit 1`); never pull the whole table to check a name. `[RUN-8]` High
- [ ] **P4.2 — Paginate `GET /api/files` + cache headers.** Add `limit`/`offset`/cursor and `Cache-Control`/`stale-while-revalidate`. `[RUN-7]` Medium
- [ ] **P4.3 — Server-side search + debounce.** Debounce the search input 150–250ms; push filtering server-side (Supabase `ilike` + pagination). `[RUN-3]` Medium
- [ ] **P4.4 — Single `card-grid`, conditional dim class.** Stop duplicating the grid JSX across drawer-open/closed branches (currently forces full unmount/remount of every `FileCard`). `[RUN-4]` `[CODE-47]` Medium
- [ ] **P4.5 — Code-split `UploadDrawer`.** `next/dynamic` import so the drawer chunk loads only when opened. `[RUN-6]` Low
- [ ] **P4.6 — Memoize + split page state.** Wrap `FileCard`/`TopNav`/`StatStrip` in `React.memo`; split page-level state so unrelated components don't re-render. `[RUN-5]` Low-Medium
- [ ] **P4.7 — Virtualize the grid.** Add `react-window`/`react-virtual` once file counts exceed ~50–100. `[RUN-4]` Low
- [ ] **P4.8 — Supabase client singleton.** Memoize at module scope (`client ??= createClient(...)`) respecting cold-start. `[RUN-10]` Low
- [ ] **P4.9 — Revisit `next.config.js` output/caching.** Consider `output: 'standalone'` + image config once Storage assets/thumbnails exist. `[RUN-11]` `[CODE-102]` Low
- [ ] **P4.10 — CSS scroll cost.** If long lists make scroll janky, replace `background-attachment: fixed` with a positioned pseudo-element; add scoped `will-change: transform` on `.file-card:hover`. `[RUN-12]` `[RUN-13]` Low

---

## Phase 5 — Cleanup, correctness & docs

- [ ] **P5.1 — Remove the fake "Admin Mode" concept.** `adminOn` prop / "Admin Mode" pill implies a role system that doesn't exist (v1 scopes roles out). Rename/remove in `app/dashboard/page.tsx:31` and `components/TopNav.tsx:9`. `[CODE-46]` `[CODE-64]` Medium
- [ ] **P5.2 — Fix `StatStrip`.** Remove dead/misnamed `totalSize` var; source stats from the data layer instead of hardcoded `1.2 TB` / `318`. `[CODE-60]` `[CODE-61]` Medium
- [ ] **P5.3 — Wrap `fetch` in try/catch.** In `app/page.tsx` `handleSubmit` and `UploadDrawer` — a network rejection currently leaves `saving`/loading stuck forever. `[CODE-70]` Medium
- [ ] **P5.4 — Reconcile `CLAUDE.md` with reality.** It references nonexistent `.scratch/` and `docs/agents/*.md`. Either create those or remove the references. `[CODE-105]` Medium
- [ ] **P5.5 — Remove dead `SESSION_COOKIE` re-export** from `lib/auth.ts:23` (every consumer imports from `lib/session.ts`). `[CODE-75]` Low-Medium
- [ ] **P5.6 — Derive `Tab` type from `Category`** in `app/dashboard/page.tsx`, not from the mock-data runtime array. `[CODE-45]` Low
- [ ] **P5.7 — Decide `notes` field's fate.** Currently write-only (captured by form, never rendered). Either render it in `FileCard` or drop it. `[CODE-88]` Low
- [ ] **P5.8 — Wire up inert controls.** `Download` / `⋯` in `FileCard` and the non-interactive tab `div`s need handlers + keyboard/ARIA semantics. `[CODE-56]` Low (overlaps accessibility audit)
- [ ] **P5.9 — Style consistency.** Move `ConflictToast` inline styles into `globals.css`; standardize on a named `interface Props` across components. `[CODE-51]` `[CODE-65]` Low
- [ ] **P5.10 — Add `app/dashboard/loading.tsx`.** Suspense/loading boundary ahead of real async data. `[RUN-2]` Low
- [ ] **P5.11 — Naming/theme nits.** `data-theme="sunset"` → a typed `Theme` constant; consider renaming `PasswordGatePage`; document `ConflictToast`'s backdrop in `DESIGN.md`. `[CODE-25]` `[CODE-29]` `[CODE-108]` Low

---

## Suggested execution order

1. **Phase 0** (tooling) — enables safe iteration.
2. **Phase 1** (critical security) — must land before any real file handling.
3. **Phase 2** (architecture) — the refactor everything else builds on.
4. **Phase 3** (security hardening) — right after the API/repo seam exists.
5. **Phase 4** (performance) — pair with the actual Supabase integration.
6. **Phase 5** (cleanup) — safe to interleave anytime after Phase 0.
