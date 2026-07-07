import "server-only";

import { getSupabaseServerClient } from "./supabase";

/** Private bucket holding installer binaries (created via `npm run setup:storage`). */
export const INSTALLERS_BUCKET = "installers";

/**
 * How long a signed download URL stays valid. Short-lived to limit link sharing
 * (prd.md §4 Security): the technician clicks download and the browser fetches
 * immediately.
 */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Mint a signed URL the browser PUTs the file bytes to directly — bypassing our
 * API route so uploads aren't capped by the serverless request-body limit
 * (prd.md §5). The returned `signedUrl` is absolute and self-authorizing; the
 * browser needs no Supabase key.
 */
export async function createUploadTarget(storageKey: string): Promise<string> {
  const client = getSupabaseServerClient();
  const { data, error } = await client.storage
    .from(INSTALLERS_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error || !data) {
    throw new Error(`createUploadTarget failed: ${error?.message ?? "no data"}`);
  }
  return data.signedUrl;
}

/**
 * Authoritative size (bytes) of an already-uploaded object, or null if it isn't
 * there. Read from Storage rather than trusting the client's reported size.
 */
export async function getObjectSize(storageKey: string): Promise<number | null> {
  const client = getSupabaseServerClient();
  const slash = storageKey.lastIndexOf("/");
  const folder = slash === -1 ? "" : storageKey.slice(0, slash);
  const filename = storageKey.slice(slash + 1);

  const { data, error } = await client.storage
    .from(INSTALLERS_BUCKET)
    .list(folder);
  if (error) throw new Error(`getObjectSize failed: ${error.message}`);

  const match = data?.find((o) => o.name === filename);
  const size = match?.metadata?.size;
  return typeof size === "number" ? size : null;
}

/** Short-lived signed URL that forces a browser download with `filename`. */
export async function createDownloadUrl(
  storageKey: string,
  filename: string
): Promise<string> {
  const client = getSupabaseServerClient();
  const { data, error } = await client.storage
    .from(INSTALLERS_BUCKET)
    .createSignedUrl(storageKey, DOWNLOAD_URL_TTL_SECONDS, { download: filename });
  if (error || !data) {
    throw new Error(`createDownloadUrl failed: ${error?.message ?? "no data"}`);
  }
  return data.signedUrl;
}

/**
 * Best-effort delete — used to clean up an orphaned object when a commit fails.
 * Failures are logged (not thrown) so the caller's response isn't derailed,
 * but the leaked key is findable in the logs / by the orphan-cleanup script.
 */
export async function removeObject(storageKey: string): Promise<void> {
  const client = getSupabaseServerClient();
  const { error } = await client.storage.from(INSTALLERS_BUCKET).remove([storageKey]);
  if (error) {
    console.warn(`[storage] failed to remove object "${storageKey}": ${error.message}`);
  }
}
