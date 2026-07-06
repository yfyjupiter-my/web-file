// One-off: create the private `installers` Storage bucket. Idempotent.
// Runtime never creates buckets — this is provisioning, like a migration.
//
// Usage:  node --env-file=.env.local scripts/setup-storage.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (use --env-file=.env.local).");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "installers";

// No explicit fileSizeLimit → inherits the project's global Storage limit
// (50MB on the free tier). Raise the global limit in the Supabase dashboard to
// support larger installers, and update MAX_UPLOAD_MB in lib/validation.ts.
const { error } = await admin.storage.createBucket(BUCKET, { public: false });

if (error && !/already exists/i.test(error.message)) {
  console.error("createBucket failed:", error.message);
  process.exit(1);
}
console.log(error ? `bucket "${BUCKET}" already exists — ok` : `bucket "${BUCKET}" created (private)`);
