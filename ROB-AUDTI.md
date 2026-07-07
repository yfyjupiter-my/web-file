# Robustness & Error Handling Audit — Installer Vault

_Date: 2026-07-07 — full-repo sweep at HEAD `73e2cac`_

Item: All direct-connection clients share one rate-limit bucket
   Verdict: ❌ Issue
   Notes: `clientKey()` falls back to `"unknown"` when neither `x-forwarded-for` nor `x-real-ip` is present — which is *every* client on a direct (non-proxied) standalone deploy. Five failed logins from anyone then lock out everyone, including the change-password endpoint (shared store). Self-inflicted DoS with no attacker required.
   Required Actions: Use the socket remote address when proxy headers are absent (and see SEC-AUDIT 2026-07-07 for the spoofing half of this problem).

Item: Repo/storage exceptions bubble to framework 500s with no route-level handling
   Verdict: ⚠️ Improvement
   Notes: Handlers (e.g. `POST /api/files` calling `getObjectSize`, all repo methods) have no try/catch except the final `repo.create`; a Supabase outage yields Next's generic 500. Nothing sensitive leaks (thrown messages stay server-side), but clients get an unstructured error the UI can't distinguish from a bug, and in the commit route a `getObjectSize` throw skips the orphan-cleanup path (see RUN-AUDIT).
   Required Actions: Add a small `withErrorBoundary` (or extend `withAuth`) returning a typed `{ ok:false, error }` 500 and logging the cause; ensure commit-route failures after upload still attempt `removeObject`.

Item: Browser upload has no timeout or stall detection
   Verdict: ⚠️ Improvement
   Notes: `putWithProgress` (lib/upload-xhr.ts) handles `onerror`/`onabort` but sets no `xhr.timeout`/`ontimeout`; a stalled connection leaves the promise pending and the modal stuck at a frozen progress bar indefinitely.
   Required Actions: Set a generous `xhr.timeout` (scaled to `MAX_UPLOAD_BYTES`) and reject with a retryable message; also surface non-2xx PUT responses (`{ ok:false }`) with the status.

Item: Malformed-input handling on API surfaces
   Verdict: ✅ Correct
   Notes: `parseJsonBody` never throws (null on bad JSON) and `validateUploadPayload` handles null bodies; every string field is length-capped and charset-checked with typed, client-safe error strings; query pagination params are parsed defensively; `verifySessionToken` fails closed on every malformed-token path (verified by tests in lib/auth.test.ts, validation.test.ts, rate-limit.test.ts).
   Required Actions: None.

Item: Degraded-infrastructure fallbacks
   Verdict: ✅ Correct
   Notes: Missing Supabase env vars fall back to in-memory repos so the app still runs; the settings-repo lookup failure inside `checkPassword` is caught and logged rather than bricking login (business-logic caveat recorded in BUS-AUDIT); boot-time validation fails fast in production but only warns in dev.
   Required Actions: None.

## Remediation — 2026-07-07

- Shared-bucket lockout: direct (non-proxied) clients still share one key by design, but the per-key free tier plus the new short-capped global bucket bound the lockout to ≤60s; spoofable headers are no longer trusted (see SEC-AUDIT remediation).
- Upload stall: `putWithProgress` now sets `xhr.timeout` (2min floor + size-scaled) with an `ontimeout` rejection, and returns the HTTP status on failure.
- Route-level error boundary for repo/storage throws remains open (framework 500s, nothing sensitive leaked).
