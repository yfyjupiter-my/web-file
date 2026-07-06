import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { createDownloadUrl } from "@/lib/storage";

/**
 * Auth-gated download: look up the file's private-bucket object path, mint a
 * short-lived signed URL, and 302 to it so the browser downloads straight from
 * Storage (never proxied through this function — prd.md §4). The binary itself
 * is never public; only holders of the session cookie can obtain a signed URL.
 */
export const GET = withAuth(async (req) => {
  // Path is /api/files/<id>/download — the id is the second-to-last segment.
  const segments = req.nextUrl.pathname.split("/");
  const id = segments[segments.length - 2] ?? "";

  const storageKey = await getFilesRepo().getStorageKey(id);
  if (!storageKey) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const filename = storageKey.slice(storageKey.lastIndexOf("/") + 1);
  const url = await createDownloadUrl(storageKey, filename);
  return NextResponse.redirect(url, 302);
});
