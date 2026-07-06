import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { getCategoriesRepo } from "@/lib/categories-repo";
import { removeObject } from "@/lib/storage";
import { validateUploadPayload } from "@/lib/validation";
import type { DeleteResponse, UpdateFilePayload, UpdateResponse } from "@/lib/types";

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

/** Updates one installer's editable metadata (name/category/version/notes). */
export const PATCH = withAuth(async (req) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const segments = req.nextUrl.pathname.split("/");
  const id = segments[segments.length - 1] ?? "";

  const body = await parseJsonBody<Partial<UpdateFilePayload>>(req);
  const validCategories = await getCategoriesRepo().list();
  const result = validateUploadPayload(body, validCategories);
  if (!result.ok) {
    return NextResponse.json<UpdateResponse>(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  const repo = getFilesRepo();
  const existing = await repo.findByName(result.value.name);
  if (existing && existing.id !== id) {
    return NextResponse.json<UpdateResponse>(
      { ok: false, conflict: true },
      { status: 409 }
    );
  }

  const file = await repo.update(id, result.value);
  if (!file) {
    return NextResponse.json<UpdateResponse>(
      { ok: false, error: "File not found." },
      { status: 404 }
    );
  }

  return NextResponse.json<UpdateResponse>({ ok: true, file });
});
