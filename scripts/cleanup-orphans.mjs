// Sweep the `installers` bucket for orphaned objects (RUN audit 2026-07-07):
// uploads whose signed-URL PUT succeeded but whose commit (POST /api/files)
// never happened leave objects with no `files` row pointing at them. Deletes
// any object under an id-folder that (a) has no matching row and (b) is older
// than the grace period — recent objects may belong to an in-flight upload.
//
// Usage:  node --env-file=.env.local scripts/cleanup-orphans.mjs [--dry-run]
// Run manually or on a schedule (cron / GitHub Action).
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (use --env-file=.env.local).");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "installers";
// Long enough that even a 50MB upload on a slow link + a retry has finished.
const GRACE_HOURS = 24;

const admin = createClient(url, key, { auth: { persistSession: false } });

// 1. Every storage_key the metadata table still references.
const { data: rows, error: rowsError } = await admin.from("files").select("storage_key");
if (rowsError) {
  console.error("failed to read files rows:", rowsError.message);
  process.exit(1);
}
const referenced = new Set(rows.map((r) => r.storage_key));

// 2. Every object in the bucket. Layout is `<uuid>/<filename>`, so list the
//    id-folders at the root, then the file(s) inside each.
const cutoff = Date.now() - GRACE_HOURS * 60 * 60 * 1000;
let scanned = 0;
let removed = 0;

const { data: folders, error: listError } = await admin.storage
  .from(BUCKET)
  .list("", { limit: 10_000 });
if (listError) {
  console.error("failed to list bucket root:", listError.message);
  process.exit(1);
}

for (const folder of folders ?? []) {
  // Root-level plain files (no id-folder) are unexpected; skip them.
  if (folder.id) continue;

  const { data: objects, error } = await admin.storage
    .from(BUCKET)
    .list(folder.name, { limit: 100 });
  if (error) {
    console.warn(`skipping folder "${folder.name}": ${error.message}`);
    continue;
  }

  for (const obj of objects ?? []) {
    scanned += 1;
    const storageKey = `${folder.name}/${obj.name}`;
    if (referenced.has(storageKey)) continue;

    const createdAt = obj.created_at ? Date.parse(obj.created_at) : NaN;
    if (!Number.isFinite(createdAt) || createdAt > cutoff) continue; // in grace period

    if (DRY_RUN) {
      console.log(`[dry-run] would remove orphan: ${storageKey}`);
      removed += 1;
      continue;
    }
    const { error: removeError } = await admin.storage.from(BUCKET).remove([storageKey]);
    if (removeError) {
      console.warn(`failed to remove "${storageKey}": ${removeError.message}`);
    } else {
      console.log(`removed orphan: ${storageKey}`);
      removed += 1;
    }
  }
}

console.log(
  `${DRY_RUN ? "[dry-run] " : ""}done — ${scanned} objects scanned, ${removed} orphan(s) ${DRY_RUN ? "found" : "removed"} (grace: ${GRACE_HOURS}h)`
);
