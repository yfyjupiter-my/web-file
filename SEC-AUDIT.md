# Security Vulnerabilities Audit — Installer Vault

_Date: 2026-07-03_

## Scope reviewed
`app/layout.tsx`, `app/page.tsx`, `app/api/auth/route.ts`, `app/api/files/route.ts`, `app/dashboard/page.tsx`, `components/{ConflictToast,FileCard,StatStrip,TopNav,UploadDrawer}.tsx`, `lib/{auth,mock-data,session,supabase,types}.ts`, `middleware.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.js`, `.env.example`, `.env.local`, `prd.md`, `README.md`.

`.env.local` contains only `SITE_PASSWORD=<value>` — value not reproduced here. No Supabase vars are set (matches README's "not wired up" status).

---

## Findings

### 1. Session cookie is an unsigned static constant — full authentication bypass by forgery
- **File**: `lib/auth.ts:19-21`, `app/api/auth/route.ts:12-19`, `middleware.ts:4-9`, `lib/session.ts:1`
- **Severity: Critical**
- The entire session mechanism is: cookie `installer_vault_session` = literal string `"1"`. `isAuthenticated()` and `middleware.ts` both do `=== "1"`. There is no HMAC/signature, no random session ID, no server-side session store, and no binding to the original password check. Anyone who can set a cookie of that name/value — via any HTTP client, manual crafting, a proxy, etc. — is treated as fully authenticated, without ever guessing the real password.
- **Exploit scenario**: `curl -H "Cookie: installer_vault_session=1" https://host/dashboard` bypasses the password gate entirely.
- **Fix direction**: Replace with a signed/encrypted session token (HMAC-SHA256 over a random session ID + expiry using a server-only `COOKIE_SECRET`, or a signed JWT, or `iron-session`/`next-auth`). Validate the signature server-side on every request. Note `prd.md` §4 already calls for a "signed httpOnly cookie" and lists `COOKIE_SECRET` as a required env var — neither was actually implemented.

### 2. No rate limiting / brute-force protection on `/api/auth`
- **File**: `app/api/auth/route.ts:5-21`
- **Severity: High**
- `POST /api/auth` accepts unlimited password attempts with no throttling, lockout, or CAPTCHA, despite `prd.md` §4 explicitly flagging this as required mitigation. Since a single shared password is the only defense for the entire file repository, this is directly brute-forceable.
- **Fix direction**: Add per-IP/per-session throttling (e.g., Upstash rate limiter or Vercel KV), exponential backoff, and alerting on repeated failures.

### 3. Weak default password shipped in example env
- **File**: `.env.example:2` (`SITE_PASSWORD=changeme`)
- **Severity: Medium**
- README instructs `cp .env.example .env.local`; a deployer who forgets to change the value ships the well-known password `changeme`.
- **Fix direction**: Use an obviously invalid placeholder (e.g., `REPLACE_ME_BEFORE_DEPLOY`) and/or add a startup check that refuses to boot or warns loudly if `SITE_PASSWORD` still equals the placeholder.

### 4. No CSRF token; mutating requests rely solely on cookie + SameSite
- **File**: `app/api/files/route.ts:10-39`, `app/api/auth/route.ts`
- **Severity: Medium**
- `POST /api/files` authorizes purely via the session cookie, with `SameSite=Lax` (`app/api/auth/route.ts:15`) as the only CSRF mitigation. This blocks classic cross-site form/XHR CSRF in modern browsers, but is a single point of failure with no defense-in-depth (no CSRF token, no Origin/Sec-Fetch-Site validation). Severity will rise once real upload/delete/replace against Supabase is wired in.
- **Fix direction**: Add explicit `Origin`/`Sec-Fetch-Site` header validation on all mutating routes before wiring in real persistence.

### 5. Missing security headers (CSP, X-Frame-Options, etc.)
- **File**: `next.config.js:1-4` (empty), `middleware.ts` (no header injection)
- **Severity: Medium**
- No CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, or `Permissions-Policy` are set. The password-gate and dashboard pages can be framed by any external site (clickjacking).
- **Exploit scenario**: Attacker embeds `/dashboard` in an invisible iframe and tricks an authenticated user into clicking through an overlay.
- **Fix direction**: Add a `headers()` function in `next.config.js` (or middleware) setting `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`; confirm HSTS (Vercel adds by default).

### 6. No server-side input validation on upload metadata
- **File**: `app/api/files/route.ts:22-38`, `components/UploadDrawer.tsx:19-35`
- **Severity: Medium**
- `name`, `category`, `version`, `notes` are accepted with no length limits, no charset restriction, and no validation that `category` matches the closed `Category` union. Low real-world impact today since the endpoint is stubbed, but this is exactly the code path that becomes the real upload handler.
- **Forward-looking impact**: If `name` is later used verbatim as part of a Supabase Storage object key, this becomes a path-traversal/object-key-injection vector (e.g. `name: "../../other-bucket/evil"`).
- **Fix direction**: Validate `category` against the `Category` union server-side, restrict `name`/`version` to a safe charset and max length, derive storage keys from a generated UUID rather than user-supplied `name`, cap `notes` length.

### 7. Sensitive-adjacent user input logged to server console
- **File**: `app/api/files/route.ts:28` (`console.log("[stub] would upload installer:", body)`)
- **Severity: Low**
- Logs the full raw request body including free-text `notes`, unredacted, to production logs. Unescaped user-controlled content risks log injection/forging.
- **Fix direction**: Remove before shipping past scaffold stage, or log only non-sensitive structured fields.

### 8. `lib/supabase.ts` — no `server-only` guard; RLS not documented
- **File**: `lib/supabase.ts:14-28`
- **Severity: Low** (currently unused — no client-side leakage today)
- `SUPABASE_SERVICE_ROLE_KEY` is read server-side only and not currently imported by any client component, which is correct today. But there's no `import "server-only"` guard to hard-fail if it's ever imported into a `"use client"` file, and no RLS policy discussion — since the service role key bypasses RLS entirely, all authorization will depend on the same weak session-cookie check (Finding 1) once this is wired up, with no defense-in-depth from the database layer.
- **Fix direction**: Add `import "server-only";` to `lib/supabase.ts`; document/enforce RLS policies on the `files` table as defense-in-depth even though the app path uses the service role key.

### 9. Dependency posture
- **File**: `package.json`, `package-lock.json`
- **Severity: Informational**
- `next` resolves to `14.2.35`, patched against the critical middleware auth-bypass CVE-2025-29927 (`x-middleware-subrequest` header bypass), which matters here since `middleware.ts` is the sole route-protection mechanism for `/dashboard`. `react`/`react-dom` 18.3.1, `@supabase/supabase-js` 2.110.0, `typescript` 5.9.3 — no known-critical CVEs identified. Lockfile is committed. No action required now; recommend adding `npm audit`/Dependabot/Renovate to CI given how security-critical the `next` version is to this app's auth model.

### 10. Information disclosure — no issue found
- **File**: `app/api/auth/route.ts:8-9`, `app/api/files/route.ts:11-13,23-25`
- Error responses are appropriately generic ("Incorrect password.", "Unauthorized"), no stack traces, JSON parse failures are caught rather than thrown. Positive finding, no fix needed.

### 11. Password comparison — correctly implemented
- **File**: `lib/auth.ts:6-17`
- `checkPassword` uses `crypto.timingSafeEqual` with an explicit length check before comparison, avoiding the common length-mismatch timing oracle. Satisfies `prd.md` §4's constant-time comparison requirement. No finding.

---

## Summary Table

| # | Finding | Severity |
|---|---|---|
| 1 | Session cookie is unsigned static value `"1"` — forgeable auth bypass | Critical |
| 2 | No rate limiting/brute-force protection on `/api/auth` | High |
| 3 | Weak default `SITE_PASSWORD=changeme` in `.env.example` | Medium |
| 4 | No CSRF token / Origin validation on mutating API routes (SameSite-only defense) | Medium |
| 5 | Missing security headers (CSP, X-Frame-Options, etc.) | Medium |
| 6 | No server-side input validation on upload metadata (future path-traversal risk) | Medium |
| 7 | Raw user input logged via `console.log` | Low |
| 8 | Supabase client lacks `server-only` guard; no RLS documented | Low |
| 9 | Dependency versions currently fine but no automated scanning in CI | Informational |
| 10 | Error handling / info disclosure | No issue found |
| 11 | Timing-safe password compare | Correctly implemented |

**Top priority**: Finding 1 — the session mechanism provides no cryptographic guarantee, and every other control (middleware gating, API route checks) depends on trusting that single static cookie value. This should be fixed before the app handles any real files.

---

# Security Vulnerabilities Audit — overall re-check

_Date: 2026-07-07 — full-repo sweep at HEAD `73e2cac`_

Item: Dependency vulnerabilities — `next@^14.2.5` (and bundled `postcss`)
   Verdict: ❌ Issue (High)
   Notes: `npm audit --omit=dev` reports 1 high + 1 moderate against the installed `next` 14.2.x line: DoS via Image Optimizer `remotePatterns` (GHSA-9g9p-9gw9-jx7f), HTTP request smuggling in rewrites (GHSA-ggv3-7p47-pfv8), middleware/proxy cache poisoning (GHSA-3g8h-86w9-wvmq), RSC cache poisoning (GHSA-wfc6-r584-vfw7), SSRF via WebSocket upgrades (GHSA-c4j6-fc7j-m34r), XSS with CSP nonces (GHSA-ffhc-5mcf-pf4q), i18n middleware bypass (GHSA-36qx-fr4f-26g5), plus several RSC DoS advisories. Full audit (with dev deps) shows 10 vulns incl. 1 critical. The CI gate `npm audit --audit-level=high` (ci.yml) will fail on the current lockfile. The app uses `next/image` `remotePatterns` and middleware, so several advisories are directly relevant.
   Required Actions:
   - Upgrade `next` (and `eslint-config-next`) to the latest patched release; `npm audit fix` for the rest; re-run `npm audit --audit-level=high` and the test suite.
   - Until upgraded, treat self-hosted deploys of the standalone output as exposed to the image-optimizer DoS.

Item: Login/change-password rate limiting keyed on client-controlled `X-Forwarded-For`
   Verdict: ❌ Issue (Medium–High, deployment-dependent)
   Notes: `clientKey()` in `app/api/auth/route.ts:9` and `app/api/auth/change-password/route.ts:10` takes the first `x-forwarded-for` entry verbatim. Behind a trusted proxy (Vercel) this is fine, but `next.config.js` builds a `standalone` output for self-hosting — there, an attacker sets a fresh XFF value per request and gets 5 free attempts per fake IP, defeating SEC-2 brute-force throttling entirely (bounded only by `MAX_KEYS=10000` eviction). Conversely, an attacker can spoof a victim's IP to lock the victim out.
   Required Actions:
   - Only honor `x-forwarded-for` when a trusted-proxy flag (env) is set; otherwise use the socket address.
   - Add a secondary global bucket (total failures/minute across all keys) so key-rotation can't bypass throttling.

Item: No session revocation — password change/logout do not invalidate outstanding tokens
   Verdict: ⚠️ Improvement (Medium)
   Notes: Sessions are stateless HMAC tokens (lib/session.ts) valid for 7 days. Changing the site password (`setSitePassword`) leaves every existing session valid until `exp`; logout only clears the cookie client-side, so a stolen/copied token keeps working. For a shared-password vault, rotating the password is exactly the "revoke everyone" action an admin will reach for — and it currently doesn't.
   Required Actions:
   - Embed a key-version/generation claim in the token (bump it on password change) or derive the HMAC key from `COOKIE_SECRET + password-hash` so a password change invalidates all sessions.

Item: Logout route lacks the same-origin (CSRF) guard
   Verdict: ⚠️ Improvement (Low)
   Notes: `app/api/auth/logout/route.ts` POST has no `requireSameOrigin` call (all other mutating routes have it). Worst case is forced logout — nuisance only.
   Required Actions: Add `requireSameOrigin(req)` for consistency.

Item: Security headers — no full CSP, no Permissions-Policy, HSTS platform-dependent
   Verdict: ⚠️ Improvement (Low–Medium)
   Notes: next.config.js sets frame-ancestors/nosniff/referrer (SEC-5) — good. There is still no `script-src`/`object-src` CSP (the only inline script is the static theme snippet in app/layout.tsx, so a nonce/sha CSP is feasible), no `Permissions-Policy`, and HSTS relies on the hosting platform.
   Required Actions: Add `Permissions-Policy` (camera=(), microphone=(), geolocation=()); layer a script CSP; confirm HSTS at the platform or add `Strict-Transport-Security` for standalone deploys.

Item: `COOKIE_SECRET` minimum length is 16 chars
   Verdict: ⚠️ Improvement (Low)
   Notes: lib/session.ts:27 accepts >=16 chars for an HMAC-SHA256 key; .env.example suggests 32 random bytes. 16 lowers the brute-force floor if someone sets a short value.
   Required Actions: Raise the floor to 32 chars (and mention entropy, not just length, in the error).

Item: Session token integrity, password verification, and boot-time env validation
   Verdict: ✅ Correct
   Notes: HMAC-SHA256-signed tokens with expiry, constant-time verify via `crypto.subtle.verify`, fail-closed parsing (lib/session.ts); scrypt-hashed password override with per-hash salt, `crypto.timingSafeEqual` for the env-password path, placeholder passwords refused (lib/auth.ts); production boot refuses placeholder/short secrets (instrumentation.ts). Prior audit findings 1–5 are all remediated.
   Required Actions: None.

Item: Storage/upload security model
   Verdict: ✅ Correct
   Notes: Private bucket, 300s signed download URLs, signed upload URLs minted server-side; object paths bound to server-generated UUIDs (`${id}/${safeName}`) with sanitized basenames and an extension allowlist; size read back from Storage (never trusted from the client) with over-limit objects deleted; RLS enabled default-deny with the service-role key kept server-only (`server-only` imports, ADR 0001).
   Required Actions: None. (Optional hardening: rate-limit `upload-url` minting per session to cap storage abuse.)

## Remediation — 2026-07-07

- **Dependencies**: upgraded `next` 14.2.x → 16.2.10, `react`/`react-dom` → 19.2, `eslint`→9 + flat config (`next lint` removed in Next 16; `lint` script now runs `eslint .`), `vitest`→4. `npm audit --omit=dev` is now 2 moderate (postcss bundled inside next; esbuild via vitest, dev-only) — the CI `--audit-level=high` gate passes.
- **Rate-limit key**: `clientKey` moved to lib/api-helpers.ts; proxy headers honored only when trusted (`TRUST_PROXY` env or Vercel), otherwise ignored. Added a global failure bucket in lib/rate-limit.ts (25 free, backoff capped at 60s) so XFF rotation can't buy unlimited attempts. Tests added.
- **Session revocation**: tokens now carry a `gen` claim; `setSitePassword` bumps a persisted `session_generation`, revoking all outstanding sessions. `isAuthenticated()` + the dashboard page enforce it (middleware stays signature+expiry). Change-password re-issues the requester's cookie. Test added.
- **Logout CSRF**: `requireSameOrigin` added to /api/auth/logout.
- **COOKIE_SECRET**: minimum raised 16 → 32 chars (session.ts, instrumentation.ts, .env.example). NOTE: deploys with a shorter secret must rotate it before upgrading.
- **Headers**: added `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. Full script CSP still deferred.
- Verified: lint/typecheck/48 tests/production build green; runtime smoke test confirmed login, CSRF 403, tampered-token 401, dashboard gating, and all security headers.
