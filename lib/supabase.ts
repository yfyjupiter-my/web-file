import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// P4.8 — memoize at module scope so we reuse one client across invocations
// within a warm server process instead of paying `createClient` (and its
// connection setup) on every request. A cold start naturally resets it.
let client: SupabaseClient | undefined;

/**
 * Server-side Supabase client (service-role key, server-only). Backs
 * `SupabaseFilesRepo` (lib/files-repo.ts) for the `files` metadata table and,
 * later, short-lived signed URLs for the private storage bucket (prd.md §4).
 *
 * `getFilesRepo()` only constructs the Supabase repo when both env vars are
 * present, so this throws only on genuine misconfiguration.
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, " +
        "or use lib/mock-data.ts while scaffolding the UI."
    );
  }

  client ??= createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: {
      // Next.js patches global `fetch` and caches responses in Server
      // Components by default. supabase-js goes through that fetch, so without
      // this a page render could serve a *stale* list (e.g. an empty table from
      // the first render) even after new rows are written — freshly uploaded
      // files would never appear. Force every Supabase call to bypass the Data
      // Cache so reads always hit the source. (`dynamic`/`noStore` per-route is
      // easy to forget; this makes the repo correct everywhere.)
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return client;
}
