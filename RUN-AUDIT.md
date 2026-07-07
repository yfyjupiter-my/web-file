# Runtime & Performance Audit — Installer Vault

_Date: 2026-07-03_

## Scope reviewed
`app/layout.tsx`, `app/page.tsx`, `app/api/auth/route.ts`, `app/api/files/route.ts`, `app/dashboard/page.tsx`, `components/{ConflictToast,FileCard,StatStrip,TopNav,UploadDrawer}.tsx`, `lib/{auth,mock-data,session,supabase,types}.ts`, `middleware.ts`, `app/globals.css`, `package.json`, `tsconfig.json`, `next.config.js`, `prd.md`, `README.md`.

**Key structural fact**: the entire `/dashboard` route is a single `"use client"` component that imports `mockFiles` directly rather than calling `GET /api/files`. There is no `useEffect`, no `next/image`, no `next/dynamic`, and no manual event listener/interval anywhere in the codebase — so classic leak patterns are absent today — but several structural choices will degrade once real Supabase data and larger file counts are wired in per `prd.md`.

---

## Findings

### 1. Entire dashboard forced into a Client Component — High
- **File**: `app/dashboard/page.tsx:1`
- The whole page (`"use client"` at top) includes `TopNav`, `StatStrip`, tab bar, search, view toggle, `FileCard` grid, `UploadDrawer`, and `ConflictToast`. Because the page is a Client Component, every child it imports — including `TopNav`/`StatStrip`/`FileCard`, none of which have any interactivity — is bundled and hydrated as client JS. This inflates the JS payload on every dashboard load, undermining prd.md's "site loads and lists files in under 2 seconds" success criterion (line 24).
- **Fix**: Make `app/dashboard/page.tsx` a Server Component that fetches data server-side and renders `TopNav`/`StatStrip`/`FileCard` as children; extract only the interactive parts (tabs+search+view toggle+drawer state) into a small client "DashboardControls" island.

### 2. Data source bypasses the API entirely — no server fetch, no loading state — Medium
- **File**: `app/dashboard/page.tsx:154, 170-176`
- `mockFiles` is imported directly into the client bundle rather than via `GET /api/files`, meaning the mock array is duplicated unnecessarily into client JS. When switched to a real fetch, it will likely become a client-side `useEffect`/`fetch`, introducing a new full network round trip and loading-state flash. There is no `loading.tsx`/Suspense boundary anywhere under `app/dashboard/`.
- **Fix**: Fetch file metadata in a Server Component so data is present in the initial HTML with no client-side waterfall; add `app/dashboard/loading.tsx` for the `/` → `/dashboard` transition.

### 3. Search input has no debounce; no pagination for filtering — Medium (scale-dependent)
- **File**: `app/dashboard/page.tsx:196-197`
- `query` state triggers the `useMemo` filter (lines 170-176) on every keystroke, scanning the full array with `toLowerCase()` on every item, re-rendering the whole grid. Fine at 8 mock items; prd.md anticipates growth into the hundreds. Client-side linear scan with no server-side query/pagination will not scale.
- **Fix**: Debounce the search input (150-250ms); push search/filter server-side (Supabase `ilike` + pagination/limit) once real data lands.

### 4. No virtualization; drawer toggle forces full remount of the file grid — Medium
- **File**: `app/dashboard/page.tsx:213-232`, `components/FileCard.tsx`
- The `card-grid` is rendered twice in JSX (once wrapped in `.dashboard-dim` when `drawerOpen`, once bare when not) — two structurally distinct subtrees, so React unmounts/remounts every `FileCard` when the Upload Drawer opens/closes, despite stable `key={f.id}`. Separately, there is no virtualization (e.g. `react-window`) for the grid — fine at 8 items, will linearly increase render/layout cost as installer count grows.
- **Fix**: Render one `card-grid` and conditionally apply the dimming class instead of duplicating the JSX subtree; add virtualization once file counts are expected to exceed ~50-100.

### 5. `TopNav`/`StatStrip`/`FileCard` not memoized — Low/Medium
- **File**: `components/TopNav.tsx`, `components/StatStrip.tsx`, `components/FileCard.tsx`
- All page-level state (`activeTab`, `query`, `view`, `drawerOpen`, `conflictName`) lives in one component, so any single state change re-renders `TopNav`/`StatStrip` (which do zero relevant work) and reconstructs every `FileCard` element. None use `React.memo`. Negligible at current scale; costly once dozens+ of cards exist.
- **Fix**: Wrap `FileCard`, `TopNav`, `StatStrip` in `React.memo`; split page-level state so `activeTab`/`query` changes don't force unrelated components to re-render.

### 6. `UploadDrawer` bundled eagerly instead of code-split — Low
- **File**: `components/UploadDrawer.tsx` (imported in `app/dashboard/page.tsx:8`)
- Statically imported and included in the same JS chunk as the rest of the dashboard even though it only mounts when `drawerOpen === true`. Most technician visits (the primary persona per prd.md) never open the upload drawer.
- **Fix**: `const UploadDrawer = dynamic(() => import("@/components/UploadDrawer"))` to defer this bundle until actually needed.

### 7. `GET /api/files` over-fetches — no pagination, no cache headers — Medium (scale risk)
- **File**: `app/api/files/route.ts` (GET handler)
- Returns the full `mockFiles` array unconditionally with no `limit`/`offset`/cursor and no `Cache-Control`/revalidate directive. Because the handler calls `isAuthenticated()` → `cookies()`, Next.js treats the route as fully dynamic (no caching). Acceptable today; won't scale once backed by a real, growing `files` table.
- **Fix**: Add pagination/limit params server-side; add appropriate `Cache-Control`/`stale-while-revalidate` semantics for infrequently-changing metadata once wired to Supabase.

### 8. In-memory full-array scan for name-conflict detection — High (scale bottleneck once wired to Supabase)
- **File**: `app/api/files/route.ts` (POST handler, conflict check)
- `mockFiles.some((f) => f.name.toLowerCase() === ...)` is an O(n) linear scan on every upload. This is a stub today, but establishes a pattern (fetch-then-scan in JS) that, if carried forward against Supabase (`select *` then `.some()`), would mean pulling the entire table on every single upload just to check a name collision.
- **Fix**: When wiring to Supabase, replace with an indexed query (`select id from files where lower(name) = lower($1) limit 1`); never fetch-then-scan in application code.

### 9. `console.log` of full request body on every POST — Low
- **File**: `app/api/files/route.ts` (POST handler)
- Synchronous logging of the entire upload payload on every request adds unnecessary I/O overhead per request, worse as `notes`/metadata payloads grow.
- **Fix**: Remove or gate behind a debug flag before production use.

### 10. No connection reuse / singleton pattern for Supabase client — Low (future risk)
- **File**: `lib/supabase.ts:14-33`
- `getSupabaseServerClient()` constructs a brand-new `createClient(...)` instance on every call rather than memoizing a module-level singleton. Once wired into per-request serverless route handlers, each invocation pays client-construction overhead redundantly.
- **Fix**: Memoize the client instance at module scope (`let client; export function getSupabaseServerClient() { return client ??= createClient(...) }`), respecting serverless cold-start semantics.

### 11. Empty Next config — no explicit output/caching strategy — Low
- **File**: `next.config.js:1-3`
- No `output: 'standalone'`, no explicit `images` config (moot today — no `next/image` usage anywhere; all visuals are emoji/text/CSS gradients), no custom caching headers. Not urgent at current scale.
- **Fix**: Revisit when Supabase Storage assets/thumbnails are introduced; consider `output: 'standalone'` for Vercel deployment efficiency.

### 12. `background-attachment: fixed` on a multi-layer gradient body background — Low
- **File**: `app/globals.css:44-49` (`body`), lines 27-29 (`--page-bg`)
- Forces the browser to repaint/recomposite the full-page gradient on scroll in some browsers/GPUs; applies site-wide including the dashboard route where content can scroll. Minor today given short pages; scales with page length.
- **Fix**: If scroll performance becomes noticeable with longer file lists, replace with a fixed-position pseudo-element/wrapper instead of `background-attachment: fixed`.

### 13. Hover transitions on `transform`/`box-shadow` across an unbounded grid — Low
- **File**: `components/FileCard.tsx:5`, `app/globals.css:442-452` (`.file-card:hover`)
- Cheap per-card today, but with no virtualization (finding #4) and no `will-change` hint, a much larger grid hovered/scrolled rapidly could add up to layout thrashing. Purely scale-dependent.
- **Fix**: Address alongside virtualization fix in #4; add `will-change: transform` scoped to `:hover` if it becomes measurable later.

### 14. Middleware — no issue found
- **File**: `middleware.ts:4-10`
- Only reads a single cookie and redirects — negligible cost per matched request. No action needed.

### 15. Password/session checks — no issue found
- **File**: `lib/auth.ts:6-11, 19-21`
- `timingSafeEqual` and `cookies().get(...)` are O(1)/negligible-cost operations. Not a performance concern at any realistic scale for this app.

---

## Notable non-issues (confirmed by full-repo grep)
- No `useEffect` anywhere → no stale-closure or missing-cleanup risk today (revisit once real data fetching via `useEffect`/`fetch` is introduced, per finding #2).
- No manual `addEventListener`/`setInterval`/`setTimeout` anywhere → no leak risk today.
- No `next/image` usage → image-optimization config in `next.config.js` is currently moot.
- `package.json` dependencies are minimal (`next`, `react`, `react-dom`, `@supabase/supabase-js`) with no heavy/duplicated libraries and no barrel-import patterns detected.

---

## Summary Table

| # | Finding | Severity |
|---|---|---|
| 1 | Entire dashboard forced into a Client Component | High |
| 8 | In-memory full-array scan for name-conflict detection (Supabase scale risk) | High |
| 2 | Data source bypasses API; no server fetch, no loading state | Medium |
| 3 | Search input has no debounce, no server-side pagination | Medium |
| 4 | No virtualization; drawer toggle forces full grid remount | Medium |
| 7 | `GET /api/files` over-fetches, no pagination/cache headers | Medium |
| 5 | `TopNav`/`StatStrip`/`FileCard` not memoized | Low-Medium |
| 6 | `UploadDrawer` bundled eagerly instead of code-split | Low |
| 9 | Full request body logged via `console.log` on every POST | Low |
| 10 | No Supabase client singleton/connection reuse | Low |
| 11 | Empty `next.config.js` — no output/caching strategy | Low |
| 12 | `background-attachment: fixed` on scrollable pages | Low |
| 13 | Unbounded hover transitions with no virtualization | Low |
| 14 | Middleware performance | No issue |
| 15 | Auth/session check performance | No issue |

**Top priority**: Findings #1 and #8 — converting the dashboard to a Server Component (or hybrid with a client "island") addresses the biggest current bundle-size/render cost, and replacing the in-memory scan pattern before it's carried into the Supabase integration prevents a real scalability bottleneck from being baked into the data layer.

---

## Re-run — Structured checklist (2026-07-03)

_Codebase unchanged since prior audit above (HEAD `be3fac1`, no commits since); this pass re-verifies each item against current file contents and records results in the required Item/Verdict/Notes/Required Actions format._

Item: `app/dashboard/page.tsx` rendered as a single `"use client"` component
   Verdict: ⚠️ Issue
   Notes: Whole page (lines 1-98) is client-rendered; `TopNav`, `StatStrip`, and every `FileCard` hydrate as client JS even though none but the tab/search/drawer controls need interactivity.
   Required Actions: Split into a Server Component shell + small "DashboardControls" client island (tabs, search, view toggle, drawer state).

Item: File list source (`mockFiles`) imported directly into client bundle, bypassing `GET /api/files`
   Verdict: ⚠️ Issue
   Notes: `app/dashboard/page.tsx:4,21,32,36` imports `mockFiles` straight from `lib/mock-data.ts` instead of fetching; duplicates the array into client JS and skips the API layer entirely. No `loading.tsx` exists under `app/dashboard/`.
   Required Actions: Fetch via Server Component (or the API route) so data ships in initial HTML; add `app/dashboard/loading.tsx` ahead of a real async data source.

Item: Client-side search/filter (`useMemo` at `app/dashboard/page.tsx:20-26`)
   Verdict: ✅ Correct (at current scale)
   Notes: `mockFiles` has 8 items — negligible cost. No debounce on the `onChange` at line 47, and filtering is an unindexed `.filter()` + `.toLowerCase()` per keystroke.
   Required Actions: None now. Add debounce (150-250ms) and move filtering server-side (Supabase `ilike` + pagination) once real/larger datasets are wired in.

Item: Duplicate `card-grid` JSX subtree for drawer-open vs. drawer-closed states (`app/dashboard/page.tsx:62-83`)
   Verdict: ⚠️ Issue
   Notes: The grid is written twice (once inside `.dashboard-dim` wrapper, once bare) instead of one grid with a conditional class. React treats these as structurally different trees, so every `FileCard` unmounts/remounts on drawer open/close despite stable `key={f.id}`.
   Required Actions: Render a single `card-grid` and toggle the `dashboard-dim` class conditionally instead of duplicating the subtree.

Item: No virtualization on the file grid (`components/FileCard.tsx`, grid render in `page.tsx`)
   Verdict: ✅ Correct (at current scale)
   Notes: Only 8 mock items today; render cost is trivial. No `react-window`/`react-virtual` present.
   Required Actions: None now. Add virtualization once file counts are expected to exceed ~50-100 (per prd.md growth expectations).

Item: `TopNav` / `StatStrip` / `FileCard` memoization
   Verdict: ⚠️ Minor issue
   Notes: None of `components/{TopNav,StatStrip,FileCard}.tsx` use `React.memo`. All page state lives in one component (`activeTab`, `query`, `view`, `drawerOpen`, `conflictName`), so any state change re-renders these siblings even though most received props are unchanged.
   Required Actions: Wrap in `React.memo`; low priority until list sizes grow past current 8-item scale.

Item: `UploadDrawer` import strategy (`app/dashboard/page.tsx:8`)
   Verdict: ⚠️ Minor issue
   Notes: Statically imported (99 lines, `components/UploadDrawer.tsx`) and bundled with the main dashboard chunk even though it only renders when `drawerOpen === true`.
   Required Actions: Convert to `next/dynamic` import to defer this chunk until the Upload button is clicked.

Item: `GET /api/files` handler (`app/api/files/route.ts:10-15`)
   Verdict: ⚠️ Issue
   Notes: Returns the full `mockFiles` array unconditionally — no `limit`/`offset`/cursor params, no `Cache-Control` header. Calls `isAuthenticated()` (which reads `cookies()`), so the route is already fully dynamic/uncached by Next.js. Fine at 8 stub records.
   Required Actions: Add pagination once backed by a real, growing table; add `Cache-Control`/`stale-while-revalidate` for metadata that doesn't change often.

Item: `POST /api/files` conflict check (`app/api/files/route.ts:30-32`)
   Verdict: ⚠️ Issue
   Notes: `mockFiles.some((f) => f.name.toLowerCase() === ...)` is an O(n) full-array scan per upload. Confirmed still present, unchanged from prior pass. This is a stub today, but the pattern (fetch-then-scan in application code) is the risk — if ported as-is against Supabase it means pulling the whole table per upload just to check one name collision.
   Required Actions: Replace with an indexed query (`select id from files where lower(name) = lower($1) limit 1`) when wiring to Supabase; do not fetch-then-scan.

Item: `console.log` of full request body on every POST (`app/api/files/route.ts:28`)
   Verdict: ⚠️ Minor issue
   Notes: `console.log("[stub] would upload installer:", body)` runs unconditionally on every request; adds sync I/O overhead that scales with payload size (e.g. `notes` field).
   Required Actions: Remove or gate behind a debug env flag before production use.

Item: Supabase client construction (`lib/supabase.ts:14-27`)
   Verdict: ⚠️ Minor issue
   Notes: `getSupabaseServerClient()` calls `createClient(...)` fresh on every invocation rather than memoizing a module-level singleton. Currently unreachable in practice (throws until env vars are set — confirmed, function is unused elsewhere in the codebase), so zero runtime cost today.
   Required Actions: Memoize the client at module scope (`client ??= createClient(...)`) when this is actually wired up, respecting serverless cold-start semantics.

Item: `next.config.js` output/caching strategy
   Verdict: ✅ Correct (at current scale)
   Notes: Config is empty (`{}`, 4 lines). No `next/image` usage anywhere in the repo (confirmed via grep), so default image config is moot. No custom headers needed yet.
   Required Actions: None now. Revisit (`output: 'standalone'`, image config) once Supabase Storage assets/thumbnails are introduced.

Item: `middleware.ts` per-request cost
   Verdict: ✅ Correct
   Notes: Reads a single cookie (`req.cookies.get(SESSION_COOKIE)`) and redirects — O(1), negligible. Matcher scoped to `/dashboard/:path*` only.
   Required Actions: None.

Item: `lib/auth.ts` session/password check cost
   Verdict: ✅ Correct
   Notes: Uses `timingSafeEqual` and a single `cookies().get(...)` read — both O(1)/negligible for this app's scale.
   Required Actions: None.

Item: Memory-leak patterns repo-wide (`useEffect` cleanup, `setInterval`/`setTimeout`, manual `addEventListener`)
   Verdict: ✅ Correct
   Notes: Confirmed via grep — zero occurrences of `useEffect`, `addEventListener`, `setInterval`, or `setTimeout` anywhere in `app/`, `components/`, or `lib/`. No leak risk exists today because there is no subscription/timer/listener code to leak.
   Required Actions: None now. Re-check this item specifically once real data-fetching (`useEffect`/`fetch`) or any subscription-based UI is introduced — that is the point where cleanup-function bugs typically get introduced.

Item: `app/globals.css` scroll/repaint cost (`background-attachment: fixed` on `body`, hover transitions on `.file-card`)
   Verdict: ✅ Correct (at current scale)
   Notes: 878-line stylesheet; fixed-attachment gradient background and `transform`/`box-shadow` hover transitions on file cards are cheap at the current 8-card, single-screen scale.
   Required Actions: None now. Revisit if scroll perf becomes noticeable with longer file lists (replace `background-attachment: fixed` with a positioned pseudo-element; consider scoped `will-change: transform`).

### Summary
No new leaks or regressions since the prior full audit — code is unchanged at HEAD `be3fac1`. All previously identified issues (dashboard client-boundary, duplicate grid subtree, unpaginated API, O(n) conflict scan, missing debounce/memoization/code-splitting) remain open and are re-confirmed above. No `useEffect`/timer/listener-based memory leaks exist because no such code exists yet in the repo. Highest-priority items unchanged: **client/server boundary on `app/dashboard/page.tsx`** and **O(n) name-conflict scan in `POST /api/files`** (the latter matters most because it's the pattern most likely to be carried forward verbatim into the real Supabase integration).

---

# Runtime & Performance Leaks — overall re-check

_Date: 2026-07-07 — full-repo sweep at HEAD `73e2cac`_

Item: Orphaned Storage objects from abandoned upload flows
   Verdict: ❌ Issue (resource leak)
   Notes: `POST /api/files/upload-url` and `POST /api/files/[id]/replace-url` mint a signed URL and the browser PUTs bytes directly to Storage; the metadata row is only written at commit. If the user closes the tab (or commit validation fails before any `removeObject` path is reached — e.g. `getObjectSize` throwing), the uploaded object stays in the private bucket forever. Nothing sweeps the bucket against the `files` table.
   Required Actions: Add a periodic cleanup (cron/edge function) deleting bucket objects older than N hours whose `id/` prefix has no matching `files` row.

Item: `removeObject()` swallows errors silently
   Verdict: ⚠️ Improvement
   Notes: lib/storage.ts:68 ignores the result of `.remove()`. A failed delete (transient Supabase error) silently leaks the object with no log to find it later.
   Required Actions: Log failures (key + error) so orphans are discoverable.

Item: In-memory rate-limit store growth
   Verdict: ✅ Correct
   Notes: Bounded by `MAX_KEYS=10000` with idle-TTL sweep and oldest-first eviction (lib/rate-limit.ts); cannot OOM. Known limitation (documented): per-instance only — swap for a shared store before scaling out.
   Required Actions: None now.

Item: Supabase client reuse and cache posture
   Verdict: ✅ Correct
   Notes: Client memoized at module scope (P4.8); every Supabase fetch forces `cache: "no-store"` so the Next Data Cache can't serve stale rows; list endpoint is paginated with an index behind it and short private SWR headers.
   Required Actions: None.

## Remediation — 2026-07-07

- Orphaned-object leak: added `scripts/cleanup-orphans.mjs` (`npm run cleanup:orphans`, `--dry-run` supported; 24h grace period) comparing bucket objects to `files.storage_key` rows.
- `removeObject` now logs failed deletes (key + reason) instead of swallowing them.
