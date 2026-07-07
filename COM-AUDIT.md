# Compliance & Accessibility Audit — Installer Vault

_Date: 2026-07-07 — full-repo sweep at HEAD `73e2cac`_

Item: Modal dialogs lack focus management and keyboard dismissal
   Verdict: ❌ Issue (WCAG 2.1.2 / 2.4.3)
   Notes: UploadModal, EditFileModal, ChangePasswordModal, DeleteConfirmModal, AddCategoryModal all set `role="dialog"`/`aria-modal="true"`/`aria-label` (good), but no component traps focus, moves focus into the dialog on open, restores it on close, or closes on Escape (no `Escape`/focus-handling code exists in components/). Keyboard and screen-reader users can tab into the obscured page behind the overlay.
   Required Actions: Add a focus trap + initial focus + focus restore + Escape-to-close to a shared modal wrapper (or adopt `<dialog>`/Radix Dialog).

Item: Icon-only and emoji-prefixed controls rely on visual context
   Verdict: ⚠️ Improvement (WCAG 1.1.1 / 4.1.2)
   Notes: The search input (DashboardControls.tsx:142) and login password input (app/page.tsx:59) are labelled only by an emoji + placeholder — placeholders are not accessible names and disappear on input. Decorative emoji (🔍, 🔑, 🔐) are read aloud by screen readers.
   Required Actions: Give inputs a real accessible name (`aria-label="Search installers"` etc.); mark decorative emoji `aria-hidden="true"`.

Item: Dynamic state changes are not announced
   Verdict: ⚠️ Improvement (WCAG 4.1.3)
   Notes: Login error text, the bulk-selection bar ("3 selected"), conflict toast, and upload progress render visually with no `aria-live` region, so screen-reader users get no feedback after submitting a wrong password or selecting rows.
   Required Actions: Wrap error/status text in `role="status"`/`aria-live="polite"` regions; give the upload progress bar `role="progressbar"` with `aria-valuenow`.

Item: Data-protection / compliance posture
   Verdict: ✅ Correct
   Notes: No personal data is collected or stored (shared password, no user accounts, no analytics/trackers, no third-party scripts); secrets live in env vars with `.env.local` gitignored and a placeholder-refusing boot check; binaries are private-bucket only with short-lived signed URLs; failed-login alerting never logs the attempted password. No GDPR/PII surface identified at current scope.
   Required Actions: None now. If user accounts are ever added, revisit (retention, consent, audit logging).

## Remediation — 2026-07-07

- Added `components/useModalA11y.ts` (initial focus incl. [autofocus] preference, Tab/Shift+Tab trap, Escape-to-close with in-flight guard, focus restore) and applied it to all five modals (`tabIndex={-1}` overlays).
- Search + password inputs got real `aria-label`s; decorative emoji marked `aria-hidden`.
- Live regions: `role="alert"` on all error texts (login, modals, bulk-delete), `role="status"` on the password-changed message, `aria-live="polite"` on the selection count, `role="progressbar"` with value attributes on both upload progress bars.
