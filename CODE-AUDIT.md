# Code Quality & Architecture Audit — Installer Vault

_Date: 2026-07-03_

## Scope reviewed
`app/layout.tsx`, `app/page.tsx`, `app/api/auth/route.ts`, `app/api/files/route.ts`, `app/dashboard/page.tsx`, `components/{ConflictToast,FileCard,StatStrip,TopNav,UploadDrawer}.tsx`, `lib/{auth,mock-data,session,supabase,types}.ts`, `middleware.ts`, `package.json`, `tsconfig.json`, `next.config.js`, `CLAUDE.md`, `DESIGN.md`, `prd.md`, `README.md`.

---

## Cross-cutting architecture findings

1. **`app/dashboard/page.tsx` (lines 4, 20-26, 32, 36) — Dashboard reads `mockFiles` directly from `lib/mock-data.ts` instead of calling `GET /api/files` — Severity: High.** The project has a real route handler (`app/api/files/route.ts`) gated on `isAuthenticated()`, meant to be the single source of truth for file data, but the dashboard page bypasses it entirely, importing the mock array straight into a client component. This means the API route's auth check is dead code from the UI's perspective; two divergent data paths exist that will conflict once Supabase is wired in; and `StatStrip`/tab counts are computed from a different source than what `POST /api/files` would eventually mutate. This is the single biggest layering violation in the codebase.

2. **Dual-mode mock vs. real backend is not cleanly separated — Severity: High.** `lib/mock-data.ts`, `lib/supabase.ts`, and `app/api/files/route.ts` all comment that they are stubbed/not wired up, but there is no shared abstraction (e.g. a `lib/files-repo.ts` interface with mock and Supabase implementations) to swap between them later. "Real" vs "mock" today is just a matter of which file happens to import `mockFiles` directly (four call sites: `app/dashboard/page.tsx`, `app/api/files/route.ts`, `components/UploadDrawer.tsx`, `components/StatStrip.tsx`). `lib/supabase.ts` (lines 14-28) throws when unconfigured rather than exposing a typed client interface with a dependency-injection seam.

3. **Upload flow doesn't actually mutate any observable state — Severity: Medium.** `app/api/files/route.ts`'s `POST` (lines 22-39) only `console.log`s the payload and does an in-memory `.some()` conflict check; it never persists. `UploadDrawer`'s `onSaved` just closes the drawer — the new file never appears in the grid, even after refresh. Not signposted anywhere in the UI as demo-only.

4. **No `lib/` service layer — business logic duplicated ad hoc — Severity: Medium.** The "file already exists" check lives only inline in `app/api/files/route.ts` (lines 30-33), with no exported helper for reuse. `isAuthenticated()` is called identically in both route handlers (lines 11, 23) with no shared guard/HOF (e.g. `withAuth(handler)`).

---

## File-by-file findings

### app/layout.tsx
- Line 11: `data-theme="sunset"` hardcoded on `<html>` with no `Theme` type/constant, despite DESIGN.md implying multiple themes were a design possibility. **Low.**

### app/page.tsx
- Lines 28-30: error payload has no type annotation (`data.error` accessed on an inferred/untyped object) — no shared `AuthResponse` type in `lib/types.ts`. **Low.**
- Naming: `PasswordGatePage` for the root route isn't self-documenting about the auth-gate architecture. **Low (clarity only).**

### app/api/auth/route.ts
- Line 6: `req.json().catch(() => ({ password: "" }))` silently swallows malformed JSON; same pattern duplicated in `app/api/files/route.ts` with no shared parsing helper. **Low.**
- Response envelope (`{ ok, error? }`) has no shared type from `lib/types.ts`. **Low.**
- Otherwise clean: single responsibility, cookie flags conventional, delegates password check to `lib/auth.ts`.

### app/api/files/route.ts
- Lines 5-9, 17-21: stub comments describing intended Supabase swap-in are effectively long-lived TODOs not tracked via the project's own issue-tracker convention. **Low (informational).**
- Line 28: `console.log("[stub] would upload installer:", body)` — no log-level guard; would spam prod logs if hit before replacement. **Low.**
- Line 27/31: `body` is untyped (`any`); no `UploadPayload` type exists for the posted shape (`name`, `category`, `version`, `notes`). **Low.**
- No server-side validation that `category` is a member of the `Category` union before use. **Low-Medium.**
- Duplicated `isAuthenticated()` guard across `GET`/`POST` — see cross-cutting #4.

### app/dashboard/page.tsx
- See cross-cutting #1 (**High**) — imports `mockFiles` directly rather than fetching `/api/files`.
- Lines 11, 14: `Tab` type derived as `(typeof categories)[number]` from mock-data's runtime array instead of referencing `Category` from `lib/types.ts` directly — fragile, silently breaks if `mock-data.ts` is removed. **Low.**
- Line 31: `<TopNav adminOn={drawerOpen} />` — naming mismatch; "drawer open" state is conflated with an "Admin Mode" pill, but no admin/role concept exists anywhere in the app (prd.md explicitly scopes roles out of v1). **Medium.**
- Lines 62-83: near-duplicated file-card-grid JSX repeated verbatim across the `drawerOpen`/non-`drawerOpen` branches. **Low.**
- Correct `'use client'` usage; no App Router violations.

### components/ConflictToast.tsx
- Line 9: inline `style={{ position: "fixed", ... }}` mixed with class-based styling, inconsistent with the rest of the app which relies entirely on `globals.css` per DESIGN.md. **Low.**
- No click-outside-to-dismiss handler (accessibility-adjacent, noted in passing).
- Otherwise clean typing, single responsibility.

### components/FileCard.tsx
- Lines 18-19: `Download`/`⋯` are inert `div`s with no handlers — incomplete functionality (accessibility-adjacent, noted in passing). **Low.**
- Clean, correctly typed via `InstallerFile`, no business logic mixed in.

### components/StatStrip.tsx
- Line 5: `totalSize = files.length` declared but never used, and misleadingly named (a count, not a size) — dead code that a linter should catch. **Medium** — indicates lint isn't enforced (no committed ESLint config).
- Lines 15-16, 21: hardcoded placeholder stats (`1.2 TB`, `318`) baked directly into JSX, not sourced from any data layer — spreads "fake data" across components in addition to `lib/mock-data.ts`. **Medium.**

### components/TopNav.tsx
- Line 9: `adminOn` prop/copy implies a role system that doesn't exist — duplicate of dashboard finding above. **Medium.**
- Inline prop type (`{ adminOn: boolean }`) vs. 3 of 5 other components using a named `interface Props` — style inconsistency. **Low.**

### components/UploadDrawer.tsx
- Lines 13-17: five separate `useState` calls with no shared form-state/reducer and no validation logic (only `!name` disables Save), despite prd.md implying type/size validation matters. **Low.**
- Line 4: imports `categories` from `lib/mock-data.ts` — couples a form component to mock data instead of `lib/types.ts`'s `Category` union. Duplicate of cross-cutting #2. **Low.**
- Lines 19-35: no `try/catch` around `fetch`; a network-level rejection leaves `saving` stuck `true` forever (button permanently reads "Saving…"). Same gap exists in `app/page.tsx`'s `handleSubmit` — systemic, not isolated. **Medium.**

### lib/auth.ts
- Lines 6-11: good, well-commented constant-time comparison — no issues.
- Line 19-21: `isAuthenticated()` calls `cookies()` from `next/headers` directly with no `server-only` guard/marker to prevent accidental client-component import. **Low.**
- Line 23: re-exports `SESSION_COOKIE` from `./session`, but every actual consumer (`app/api/auth/route.ts`, `middleware.ts`) imports it from `lib/session.ts` directly — this re-export is unused/dead. **Low-Medium.**

### lib/mock-data.ts
- Whole file — **Severity: High**, ties into cross-cutting #2. Serves two purposes (temporary fixture data `mockFiles`, and permanent domain taxonomy `categories`) across four consumers. Should be split: e.g. `lib/categories.ts` (permanent) vs. `lib/mock-data.ts` (temporary, deletable).

### lib/session.ts
- Trivial, single-purpose, no issues — good example of centralizing the cookie name in one place.

### lib/supabase.ts
- Whole file — **Medium.** Zero call sites anywhere in the codebase today (confirmed unused except as documentation of intent). Combined with finding #2, risk is this gets wired directly into `app/api/files/route.ts` later, reproducing the current coupling problem instead of fixing it.

### lib/types.ts
- No API contract types exist (no `AuthResponse`, no `UploadPayload`, no `FilesListResponse`) — every route handler/fetch call works with untyped/inferred JSON despite `InstallerFile` itself being well-typed. **Medium** — the main type-safety gap in the codebase.
- Line 18: `notes?: string` is captured by `UploadDrawer`'s form and sent to the API, but `mockFiles` never populates it and `FileCard` never renders it — a write-only field with no display path. **Low.**

### middleware.ts
- Clean, minimal, idiomatic — correctly scoped `matcher: ["/dashboard/:path*"]`. No issues. (Note: `app/api/files/route.ts` isn't covered by this matcher, but relies on its own `isAuthenticated()` checks instead — reasonable defense-in-depth, not a defect.)

### package.json
- No test script or test tooling (Jest/Vitest/Playwright) despite an explicit PRD with acceptance criteria. **Medium.**
- No `typecheck` script (e.g. `tsc --noEmit`) despite `tsconfig.json` having `noEmit: true` configured for exactly that purpose. **Low.**
- `eslint`/`eslint-config-next` present but no committed `.eslintrc.json`/`eslint.config.*` — lint rules aren't guaranteed reproducible across machines/CI, which explains why the unused `totalSize` var in `StatStrip.tsx` wasn't caught. **Medium.**

### tsconfig.json
- `"strict": true` — good; no explicit `any` found anywhere in the reviewed code. Positive finding.

### next.config.js
- Empty config — no preparation for prd.md's own called-out risk around large file uploads via Vercel serverless functions (signed upload URL to Supabase Storage). Not a current bug, just unprepared. **Low.**

### CLAUDE.md
- References directories/files that don't exist in the repo (`.scratch/`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`) — documentation/reality drift. **Medium.**

### DESIGN.md
- Thorough and accurate against actual component class names, except it doesn't document `ConflictToast`'s inline-style backdrop approach. **Low.**

### prd.md
- Acceptance criteria vs. code confirms several "not yet implemented" gaps (delete-with-confirmation, upload validation, signed-URL downloads) — all expected/labeled as MVP roadmap items, not defects.

### README.md
- Accurately describes the current stubbed/real split; matches code review findings with no stale/aspirational claims found. Positive finding — most trustworthy doc in the repo.

---

## Severity-ranked summary

**High**
1. Dashboard bypasses `/api/files` API route entirely, importing `lib/mock-data.ts` directly (`app/dashboard/page.tsx` lines 4, 20-32).
2. No shared data-access abstraction between mock and Supabase — dual-mode architecture exists only as scattered direct imports.
3. `lib/mock-data.ts` conflates temporary fixture data with permanent domain taxonomy (`categories`) across 4 consumers.

**Medium**
4. Upload flow doesn't persist or reflect new files anywhere observable.
5. Duplicated `isAuthenticated()` guards and duplicated "file exists" logic, no shared helpers.
6. Misleading `adminOn`/"Admin Mode" naming implies a nonexistent role system (`app/dashboard/page.tsx` line 31, `components/TopNav.tsx` line 9).
7. Missing API contract types in `lib/types.ts` — no typed request/response envelopes anywhere.
8. Dead `totalSize` var and hardcoded placeholder stats in `components/StatStrip.tsx`, uncaught due to no committed ESLint config.
9. No `try/catch` around `fetch` in `app/page.tsx` and `components/UploadDrawer.tsx` — network failure leaves UI stuck loading.
10. `CLAUDE.md` references nonexistent directories/files (`.scratch/`, `docs/agents/*.md`).
11. No test tooling/scripts in `package.json` despite an explicit PRD with acceptance criteria.
12. `lib/supabase.ts` is entirely unused/dead code today (fine as scaffolding, but no seam prepared for wiring it in cleanly).

**Low**
13. Redundant/dead `SESSION_COOKIE` re-export in `lib/auth.ts` (line 23).
14. Inconsistent `Props` typing style across components (named interface vs. inline).
15. Duplicated file-card-grid JSX block across dashboard's drawer-open branches.
16. `notes` field captured by form but never rendered anywhere (write-only).
17. `ConflictToast` mixes inline styles with the project's otherwise class/CSS-token-driven convention.
18. Various naming/clarity nits (`data-theme="sunset"` hardcoded, `PasswordGatePage` naming, missing `typecheck` script, unprepared `next.config.js` for large-upload risk called out in prd.md).

**Noted only in passing (out of scope for this audit):** inert non-interactive `div`s lacking keyboard/ARIA semantics (`FileCard`, dashboard tabs); no rate limiting on `/api/auth`; no pagination/virtualization for file lists. These belong to the accessibility, security, and performance audits respectively.
