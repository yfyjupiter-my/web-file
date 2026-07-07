# Business Logic & State Vulnerabilities Audit — Installer Vault

_Date: 2026-07-07 — full-repo sweep at HEAD `73e2cac`_

Item: Superseded env password can resurrect during a settings-store outage
   Verdict: ❌ Issue (Medium)
   Notes: `checkPassword()` (lib/auth.ts:61) falls back to `SITE_PASSWORD` whenever the settings-repo lookup *throws* — deliberately, so a missing migration doesn't brick login. But after an admin changes the password via the UI, any transient Supabase error re-enables the old env password for the duration of the outage. An attacker who knows the retired password can wait for (or induce, via load) a DB hiccup.
   Required Actions: Distinguish "table missing / never configured" (fall back) from "transient query error" (fail closed), or cache the last-seen hash in memory so outages verify against it instead of the env var.

Item: Password change is silently non-durable in mock mode
   Verdict: ⚠️ Improvement
   Notes: Without Supabase env vars, `setSitePassword` writes to `MockSettingsRepo` (in-memory). The UI reports success, but a restart reverts to `SITE_PASSWORD` — a user believes the password rotated when it didn't. Code comments acknowledge this; the user is never told.
   Required Actions: Return/display a "not persistent — configure Supabase" warning when the mock settings repo backs the change.

Item: Password change does not revoke existing sessions
   Verdict: ❌ Issue (Medium) — cross-ref SEC-AUDIT 2026-07-07
   Notes: Rotating the shared password is the natural "kick everyone out" action, yet all previously issued 7-day tokens keep working.
   Required Actions: See SEC-AUDIT — bind token validity to a password generation/version.

Item: DELETE removes the Storage object before the metadata row
   Verdict: ⚠️ Improvement
   Notes: `app/api/files/[id]/route.ts:22` deletes the object, then `repo.remove(id)`. If the row delete throws, the table still lists a file whose binary is gone (broken downloads); the client gets a 500 and may retry into confusion. Reversed order fails safe (orphaned object is caught by the cleanup job proposed in RUN-AUDIT).
   Required Actions: Delete the row first, then the object; log object-delete failures.

Item: Concurrent replace/edit race on the same file
   Verdict: ⚠️ Improvement (Low)
   Notes: Two simultaneous PATCHes with replacement binaries both read `previousStorageKey`, both commit, and the loser's "cleanup" deletes an object the winner may have just pointed the row at (only when filenames differ), or the winner's cleanup deletes the loser's fresher object. Single-admin tool in practice, so likelihood is low.
   Required Actions: Accept the risk (document), or compare-and-swap on `storage_key` in the UPDATE (`.eq("storage_key", previousStorageKey)`).

Item: Bulk delete ignores per-file failures
   Verdict: ⚠️ Improvement (Low)
   Notes: `handleBulkDelete` (app/dashboard/DashboardControls.tsx:116) fires `Promise.all` of DELETEs but never checks `res.ok`; partial failures are invisible — the refresh simply shows some rows still present with no explanation.
   Required Actions: Collect failed ids and surface a toast ("2 of 5 could not be deleted").

Item: Upload commit conflict/rollback handling
   Verdict: ✅ Correct
   Notes: Name conflicts return 409 both pre-upload (upload-url) and at commit; the unique index backstops the race, and every commit failure path deletes the just-uploaded object. Storage size is authoritative (read back from the bucket), the type is re-derived from the stored filename, and the object path is bound to the pre-assigned UUID so a caller can't commit someone else's path.
   Required Actions: None.

## Remediation — 2026-07-07

- Stale env-password resurrection: `checkPassword` caches the last-seen hash; a transient settings outage now verifies against that instead of `SITE_PASSWORD`. Test added.
- Session revocation on password change: implemented via generation claim (see SEC-AUDIT remediation).
- DELETE ordering: metadata row deleted before the Storage object (orphan on failure instead of a dead-link row; orphans swept by cleanup script).
- Bulk delete: per-file failures now counted and surfaced ("N of M could not be deleted") via Promise.allSettled + res.ok checks.
- Mock-mode password durability and the concurrent-replace race remain open (documented, low priority).
