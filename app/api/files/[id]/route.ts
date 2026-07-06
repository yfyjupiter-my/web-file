import { NextResponse } from "next/server";
import { withAuth, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { removeObject } from "@/lib/storage";
import type { DeleteResponse } from "@/lib/types";

/**
 * Deletes one installer: its Storage object (if any) and its metadata row.
 * `id` is the last path segment (mirrors the `[id]/download` route's parsing).
 */
export const DELETE = withAuth(async (req) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const segments = req.nextUrl.pathname.split("/");
  const id = segments[segments.length - 1] ?? "";

  const repo = getFilesRepo();
  const storageKey = await repo.getStorageKey(id);
  if (storageKey) await removeObject(storageKey);
  await repo.remove(id);

  return NextResponse.json<DeleteResponse>({ ok: true });
});
