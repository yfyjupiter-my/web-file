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

## Phase 3 — Security hardening — ✅ DONE (2026-07-06)

- [x] **P3.1 — Server-side upload validation.** New `lib/validation.ts` (`validateUploadPayload`): required trimmed `name` ≤80 chars with a conservative charset (no path separators/control chars), `category` via `isCategory`, `version` ≤40 chars restricted charset, `notes` capped at 500. `POST /api/files` now validates before persisting. Repo assigns a server-generated `crypto.randomUUID()` id — any future storage key derives from that, never the user `name` (path-traversal defense). Covered by `lib/validation.test.ts`. `[SEC-6]` `[CODE-40]` Medium
- [x] **P3.2 — Security headers.** `next.config.js` `headers()` applies to `/:path*`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. (Full script/style CSP deferred until asset origins are known.) `[SEC-5]` Medium
- [x] **P3.3 — CSRF defense-in-depth.** `requireSameOrigin()` in `lib/api-helpers.ts` blocks positively cross-origin requests via `Sec-Fetch-Site` (with `Origin`/`Host` fallback); applied to both `POST /api/auth` and `POST /api/files`, on top of SameSite=Lax. Non-browser clients (no signals) still pass and stay gated by auth. Covered by `lib/api-helpers.test.ts`. `[SEC-4]` Medium
- [x] **P3.4 — Harden example env.** `.env.example` → `SITE_PASSWORD=REPLACE_ME_BEFORE_DEPLOY`. New `instrumentation.ts` boot check (enabled via `experimental.instrumentationHook`) **throws in production** and **warns in dev** if `SITE_PASSWORD`/`COOKIE_SECRET` are unset/placeholder/too-short. Belt-and-suspenders: `checkPassword` rejects placeholder values so a misconfigured deploy can't be unlocked with a default. `[SEC-3]` Medium
- [x] **P3.5 — Remove raw-body logging.** Already removed in the Phase 2 route rewrite; verified no unredacted `body`/`notes` logging remains anywhere. Only remaining `console` calls are the boot warning and the password-free rate-limit alert. `[SEC-7]` `[RUN-9]` Low
- [x] **P3.6 — Document/enforce Supabase RLS.** `docs/adr/0001-supabase-rls.md`: enable RLS + default-deny on `files`, service-role bypass for the server, private storage bucket + signed URLs, UUID-derived `storage_key`, and a `lower(name)` unique index (pairs with P4.1). `[SEC-8]` Low

---

## Phase 4 — Performance & scale prep — 🟢 DONE except P4.7 (2026-07-06)

Most were "correct at current 8-item scale" — done as/just before Supabase and larger datasets land.
The frontend-only tasks landed earlier; the **Supabase-gated** tasks (P4.1/P4.2/P4.9) now land
**with the real integration** (`SupabaseFilesRepo`, see below). Only P4.7 (virtualization) stays
deferred as genuinely premature at this scale.

- [x] **P4.1 — Replace fetch-then-scan conflict check.** _Done with Supabase._ `SupabaseFilesRepo.findByName()` is now an **indexed exact match** — `select … where name_lower = $1 limit 1` against the unique index `files_name_lower_uniq` on a stored `name_lower = lower(name)` generated column (PostgREST can't filter a functional `lower(name)` index directly). No full-table scan. Verified live: a differently-cased duplicate (`"smoke test tool"` vs `"Smoke Test Tool"`) returns 409. `[RUN-8]` High
- [x] **P4.2 — Paginate `GET /api/files` + cache headers.** _Done._ `GET /api/files?limit=&offset=` returns a newest-first page (indexed by `files_uploaded_at_idx`) plus the unpaginated `total` (Supabase `count: 'exact'`); `limit` capped at 100. Response carries `Cache-Control: private, max-age=10, stale-while-revalidate=30`. `FilesRepo.list()` now returns `{ files, total }`. Verified live (total=2, `limit=1&offset=0` returns the newest row). `[RUN-7]` Medium
- [x] **P4.3 — Server-side search + debounce.** _Frontend half done._ Search input is now debounced 200ms in `DashboardControls` (separate `debouncedQuery` state driving the `useMemo` filter), so filtering no longer runs per-keystroke. The debounced value is the drop-in trigger for a server-side `ilike`+pagination fetch when Supabase lands (that server-side push stays with P4.2). `[RUN-3]` Medium
- [x] **P4.4 — Single `card-grid`, conditional dim class.** One `card-grid` instance now lives at a fixed tree position; drawer open/close only toggles the `with-drawer`/`dashboard-dim` wrapper classes instead of re-parenting the grid. Opening the drawer no longer unmounts/remounts every `FileCard`. `[RUN-4]` `[CODE-47]` Medium
- [x] **P4.5 — Code-split `UploadDrawer`.** `next/dynamic(… , { ssr: false })` in `DashboardControls` — the drawer is a separate lazy chunk fetched only when opened, kept out of the server-rendered HTML. `[RUN-6]` Low
- [x] **P4.6 — Memoize + split page state.** `FileCard` wrapped in `React.memo` (stable `file` identity from server-fetched `initialFiles`), so drawer/view/search re-renders skip unchanged cards. Debounced search (P4.3) is the state-split that keeps typing cheap. _Note:_ `TopNav`/`StatStrip` became **Server Components** in P2.4 — they render once server-side and never re-render on the client, so `React.memo` (a client-render optimization) doesn't apply; the original audit predates that conversion. `[RUN-5]` Low-Medium
- [ ] **P4.7 — Virtualize the grid.** _Deferred — premature._ At 8 items (and until file counts exceed ~50–100) virtualization adds complexity for no gain. Revisit with real datasets; add `react-window`/`react-virtual` then. `[RUN-4]` Low
- [x] **P4.8 — Supabase client singleton.** `lib/supabase.ts` now memoizes at module scope (`client ??= createClient(...)`), reusing one client across invocations in a warm process; a cold start resets it. `[RUN-10]` Low
- [x] **P4.9 — Revisit `next.config.js` output/caching.** _Done with Supabase._ Added `output: 'standalone'` (self-contained server bundle for container/serverless deploys; deploy via `node .next/standalone/server.js`) and `images.remotePatterns` scoped to the Supabase Storage host (`/storage/v1/object/**`), derived from `SUPABASE_URL`, ready for signed thumbnail URLs. `[RUN-11]` `[CODE-102]` Low
- [x] **P4.10 — CSS scroll cost.** Moved the sunset gradient off `body { background-attachment: fixed }` onto a fixed, painted-once `body::before` layer (composited, no per-frame full-viewport repaint on scroll); added scoped `will-change: transform` to `.file-card:hover` only (not the base rule, so cards aren't all promoted to layers at rest). `[RUN-12]` `[RUN-13]` Low

> ✅ Supabase is now wired in. `getFilesRepo()` returns `SupabaseFilesRepo` when
> `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, else the in-memory mock — no caller
> changes (the P2.1 seam paid off). Schema/RLS live in `supabase/migrations/0001_files.sql`
> (applied via `npm run migrate`, per ADR 0001: RLS on, default-deny, service-role bypass).
> **P4.1/P4.2/P4.9 landed against it; only P4.7 (grid virtualization) stays deferred** as premature
> below ~50–100 items. Verified green: `typecheck` · `lint` (0 warnings) · **38 tests** · `build`
> (dashboard route 2.48 kB) — plus a **live end-to-end smoke test** (auth → create → paginated
> list → 409 conflict) against the real Supabase project, with the test rows cleaned up afterward.

---

## Phase 5 — Cleanup, correctness & docs — ✅ DONE (2026-07-06)

- [x] **P5.1 — Remove the fake "Admin Mode" concept.** Dropped the `adminOn` prop and the "Admin Mode" pill from `components/TopNav.tsx` (now props-free); `app/dashboard/page.tsx` renders `<TopNav />`. No phantom role system implied. `[CODE-46]` `[CODE-64]` Medium
- [x] **P5.2 — Fix `StatStrip`.** New `lib/stats.ts` (`parseSizeLabelMB`/`formatStorageMB`/`computeFileStats`) derives stats from the file list: total installers, computed storage-used (sums parsed size labels; placeholders → 0), distinct file formats, and real category count. Removed the hardcoded `1.2 TB` / `318` / fake `▲ 3` delta and the stray inline `totalSize`. Covered by `lib/stats.test.ts`. `[CODE-60]` `[CODE-61]` Medium
- [x] **P5.3 — Wrap `fetch` in try/catch.** `app/page.tsx` `handleSubmit` and `UploadDrawer.handleSave` now use try/catch/finally — a network rejection surfaces a friendly error and always clears `submitting`/`saving` instead of hanging. Added an inline error line to the drawer. `[CODE-70]` Medium
- [x] **P5.4 — Reconcile `CLAUDE.md` with reality.** `docs/agents/*.md` and `docs/adr/0001-*` already exist. Added `.scratch/` to `.gitignore` (on-demand working dir) and annotated `CLAUDE.md` that `.scratch/` + `CONTEXT.md` are created lazily and may be absent in a fresh checkout (matches `docs/agents/domain.md`'s "proceed silently" contract). `[CODE-105]` Medium
- [x] **P5.5 — Remove dead `SESSION_COOKIE` re-export** from `lib/auth.ts`. The lone consumer was `lib/auth.test.ts`; repointed it to import `SESSION_COOKIE` from `lib/session.ts` (the canonical source). `[CODE-75]` Low-Medium
- [x] **P5.6 — Derive `Tab` type from `Category`.** Already satisfied in P2.2 — `Tab = "All" | Category` lives in `lib/categories.ts` and `DashboardControls` imports it; no derivation from the mock-data runtime array remains. `[CODE-45]` Low
- [x] **P5.7 — Decide `notes` field's fate.** Kept and now rendered — `FileCard` shows `notes` (2-line clamp via `.card-notes`) when present, so the captured field is no longer write-only. `[CODE-88]` Low
- [x] **P5.8 — Wire up inert controls.** Tab `div`s → `<button role="tab" aria-selected>` in a `role="tablist"`; view-toggle `div`s → `<button aria-pressed>` in a `role="group"`; `FileCard` footer `Download`/`⋯` → `<button>` with `aria-label` (real download stays Supabase-Storage-gated). Added `:focus-visible` outlines. CSS selectors updated to `> button` with resets. `[CODE-56]` Low
- [x] **P5.9 — Style consistency.** `ConflictToast` inline backdrop moved to a `.toast-overlay` class in `globals.css` (+ `role="alertdialog"`/`aria-modal`). Standardized on a named `interface Props` across `StatStrip`/`FileCard`/`ConflictToast`/`UploadDrawer` (`TopNav` is now props-free). `[CODE-51]` `[CODE-65]` Low
- [x] **P5.10 — Add `app/dashboard/loading.tsx`.** Suspense fallback (`role="status"`) renders the nav + a "Loading installers…" placeholder ahead of the real async Supabase query. `[RUN-2]` Low
- [x] **P5.11 — Naming/theme nits.** `data-theme="sunset"` → typed `ACTIVE_THEME` constant in `lib/theme.ts` (`Theme` union); documented `ConflictToast`'s `.toast-overlay` backdrop in `DESIGN.md` §5.13. (`PasswordGatePage` rename judged low-value churn — left as-is.) `[CODE-25]` `[CODE-29]` `[CODE-108]` Low

> ✅ Verified green: `typecheck` · `lint` (0 warnings) · **37 tests** (added `lib/stats.test.ts`) · `build` (dashboard route 2.48 kB). All 11 items landed; no items deferred.

---

## Suggested execution order

1. **Phase 0** (tooling) — enables safe iteration.
2. **Phase 1** (critical security) — must land before any real file handling.
3. **Phase 2** (architecture) — the refactor everything else builds on.
4. **Phase 3** (security hardening) — right after the API/repo seam exists.
5. **Phase 4** (performance) — pair with the actual Supabase integration.
6. **Phase 5** (cleanup) — safe to interleave anytime after Phase 0.
