import { createClient } from "@supabase/supabase-js";

/**
 * NOT WIRED UP YET.
 *
 * Per prd.md §4, this should become the server-side Supabase client
 * (service role key, server-only) used to:
 *  - query/write the `files` metadata table
 *  - generate short-lived signed URLs for the private storage bucket
 *
 * Until SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set, callers should
 * fall back to lib/mock-data.ts. This file just establishes the shape.
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

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
