# PRD: Installer Vault — Internal Installer File Repository

## Assumptions (no response received to clarifying questions — adjust as needed)

- **Access control**: Single shared password for the whole site (simplest for a small internal IT team; no per-user accounts to manage). Can upgrade to Supabase Auth with individual logins later if audit trails become necessary.
- **Upload workflow**: One or a few IT staff upload/replace files occasionally, via a simple in-app admin upload form (not the raw Supabase dashboard), so non-technical teammates can also manage files.
- **Scale**: Small-to-medium — a few GB total, most files under 500MB. Fits Supabase free tier initially; flagged as a risk if it grows past 1GB storage / 2GB monthly bandwidth.

Flag any of these to change and the doc can be revised.

---

## 1. Executive Summary

**Problem Statement**: The IT person currently copies installer files (`.exe`, `.msi`, etc.) onto a USB drive and physically carries it to each client laptop to install software — this is slow, error-prone (wrong/outdated version on the USB), and doesn't scale as the number of clients or installers grows.

**Proposed Solution**: A lightweight, password-protected web app where installer files are uploaded once and organized by category/version. On-site, the IT person opens the site on the client's laptop and downloads the installer directly — no USB media required.

**Success Criteria**:
- IT person can retrieve any current installer on a client laptop in under 2 minutes (browse + download), replacing a USB round-trip that previously took 10+ minutes (find USB, walk to laptop, copy, eject).
- Zero incidents of installing an outdated/wrong installer version within 30 days of launch (site always reflects the latest uploaded version).
- 100% of common installers (top 10 used tools) available on the site within the first week.
- Upload of a new/updated installer (up to 500MB) completes and is downloadable within 5 minutes end-to-end.
- Site loads and lists files in under 2 seconds on a typical client-site network connection.

---

## 2. User Experience & Functionality

**User Personas**:
- **IT Technician (primary user)**: Visits client sites, needs fast access to the correct installer version on unfamiliar laptops/networks. Not necessarily a developer — needs a dead-simple UI.
- **IT Admin (uploader)**: Occasionally adds new installers or replaces outdated versions from the office.

**User Stories**:
- As an IT technician, I want to browse a list of installers by name/category so I can quickly find the one I need for the client's laptop.
- As an IT technician, I want to download a file directly in the browser so I don't need any USB media or extra software.
- As an IT technician, I want to see the file's version/date and size before downloading, so I know I'm not re-downloading the same file or grabbing something too large for a slow connection.
- As an IT admin, I want to upload a new installer or replace an existing one with a new version, so the team always has the latest file available.
- As an IT admin, I want to delete outdated/unused installers, so the list stays clean and storage isn't wasted.
- As anyone accessing the site, I want a single password gate, so random visitors can't browse or download internal installers.

**Acceptance Criteria**:
- [ ] Landing page requires a password before showing any file list (session persists for the browser session/cookie).
- [ ] File list shows: name, category/tag, version or upload date, file size, and a download button.
- [ ] Files can be filtered/searched by name.
- [ ] Admin upload form accepts drag-and-drop or file picker, supports `.exe`, `.msi`, `.dmg`, `.zip`, `.pkg` and similar binary formats.
- [ ] Uploading a file with the same name as an existing one prompts to replace (versioning) rather than silently duplicating.
- [ ] Admin can delete a file, with a confirmation step.
- [ ] Site is responsive and usable on a laptop browser window (no mobile-specific requirement, but shouldn't break on a narrow window).
- [ ] Download works reliably over typical client-site Wi-Fi without requiring the technician to install anything extra (browser-native download only).

**Non-Goals**:
- No automatic installer execution/remote deployment (technician still manually runs the installer on the client laptop).
- No per-user accounts/roles in v1 (single shared password only).
- No virus/malware scanning pipeline in v1 (trusted internal uploads only — see Security section for mitigation).
- No installer packaging, silent-install scripting, or MDM/RMM integration.
- No mobile app; browser-based only.
- No file preview/execution in-browser.

---

## 3. AI System Requirements

Not applicable — this is a standard CRUD file-management app with no AI/ML component.

---

## 4. Technical Specifications

**Tech Stack** (per user request):
- **Frontend/Framework**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Hosting**: Vercel
- **Backend/Storage/DB**: Supabase (Postgres for file metadata, Supabase Storage for binaries, optionally Supabase Auth if upgraded beyond shared-password gating)

**Architecture Overview**:
- Next.js app deployed on Vercel serves the UI and API routes (Route Handlers).
- File binaries live in a **private Supabase Storage bucket** (not public) — the app generates short-lived signed URLs for downloads so files are never publicly indexable.
- File metadata (name, category, version, uploader, size, uploaded_at, storage path) stored in a Supabase Postgres table, queried via the `supabase-js` client from Next.js server components/route handlers using the service role key (server-side only, never exposed to the browser).
- Gate: a simple password check (e.g., a shared secret compared server-side, setting an httpOnly signed cookie on success) protects both the file-list page and the download/upload API routes. This avoids managing individual user accounts while still keeping files off the public internet.
- Upload flow: Admin form → Next.js API route → validates file type/size → uploads to Supabase Storage → writes/updates metadata row.
- Download flow: Technician clicks download → API route checks the password-session cookie → generates a signed, time-limited Supabase Storage URL → browser downloads directly from Supabase (not proxied through Vercel, to avoid Vercel's function payload/bandwidth limits on large files).

**Integration Points**:
- **Supabase Storage**: private bucket for installer binaries.
- **Supabase Postgres**: `files` table (id, name, category, version, size_bytes, storage_path, uploaded_by, uploaded_at, notes).
- **Auth/Gating**: environment-variable-based shared password + signed httpOnly cookie (custom, not Supabase Auth) for v1; documented as an easy swap to Supabase Auth later if per-user login is needed.
- **Vercel Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_PASSWORD`, `COOKIE_SECRET`.

**Security & Privacy**:
- Storage bucket is **private** — all access goes through signed URLs generated server-side after the password check; no direct public bucket URLs.
- Service role key used only in server-side code (API routes/server components), never shipped to the client bundle.
- Password compared using a constant-time comparison to avoid timing attacks; stored as a Vercel environment variable/secret, not in code.
- Signed download URLs expire quickly (e.g., 5–10 minutes) to limit link-sharing risk.
- No malware scanning in v1 — mitigated by restricting uploads to the trusted admin gate only (same password protects upload route) and by IT team practicing normal hygiene (only uploading installers from vendor-verified sources).
- Rate-limit or simply monitor the password gate route to reduce brute-force risk on the shared password (consider basic attempt throttling if this becomes a concern).
- HTTPS enforced by default via Vercel.

---

## 5. Risks & Roadmap

**Phased Rollout**:
- **MVP (v1)**: Password gate, file list with search, download via signed URL, basic admin upload/replace/delete form. Deployed on Vercel + Supabase free tier.
- **v1.1**: Categories/tags for organizing installers (e.g., by department, OS), upload history/audit log (who uploaded what, when), basic file-count/storage-usage dashboard for the admin.
- **v2.0**: Optional upgrade to Supabase Auth for per-user logins and download audit trail; optional malware-scan step on upload (e.g., via a third-party scanning API) if the file volume/exposure grows.

**Technical Risks**:
- **Supabase free-tier limits**: 1GB storage / 2GB bandwidth per month may be exceeded quickly with large installers and frequent downloads — monitor usage early and be ready to upgrade to Supabase Pro (~$25/mo, 100GB storage).
- **Large file uploads via serverless functions**: Vercel API routes have payload size limits (default ~4.5MB request body on Hobby, larger on Pro) — mitigate by uploading directly from the browser to Supabase Storage using a signed upload URL (client-side direct upload) rather than proxying the file through a Vercel function.
- **Shared password leakage**: if the single password is shared broadly or written down insecurely, files become exposed — mitigate by rotating the password periodically and keeping the IT team small; revisit per-user auth if this becomes a real concern.
- **No malware scanning**: a compromised installer could be uploaded and distributed to client laptops — mitigated for v1 by restricting uploads to trusted staff only; flagged for v2 if the team grows.
