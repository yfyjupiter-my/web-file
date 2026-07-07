import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { getCategoriesRepo } from "@/lib/categories-repo";
import { getObjectSize, removeObject } from "@/lib/storage";
import { isUuid, validateFilename, validateUploadPayload } from "@/lib/validation";
import type { DeleteResponse, FileType, UpdateFilePayload, UpdateResponse } from "@/lib/types";

/**
 * Deletes one installer: its metadata row first, then its Storage object.
 * Row-first fails safe — if the object delete then fails, we leak an orphan
 * (swept by scripts/cleanup-orphans.mjs) instead of listing a file whose
 * binary is gone.
 */
export const DELETE = withAuth(async (req, context) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const repo = getFilesRepo();
  const storageKey = await repo.getStorageKey(id);
  await repo.remove(id);
  if (storageKey) await removeObject(storageKey);

  return NextResponse.json<DeleteResponse>({ ok: true });
});

/**
 * Updates one installer's editable metadata (name/category/version/notes), and
 * optionally swaps its binary when the body carries a `storageKey` from a prior
 * `POST /api/files/:id/replace-url` upload (the old object is removed after
 * the row commits successfully).
 */
export const PATCH = withAuth(async (req, context) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json<UpdateResponse>(
      { ok: false, error: "File not found." },
      { status: 404 }
    );
  }

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

  // Present only when the user attached a replacement file in EditFileModal.
  const storageKey = body?.storageKey ? String(body.storageKey) : undefined;
  let previousStorageKey: string | null = null;
  let sizeBytes: number | undefined;
  let type: FileType | undefined;

  if (storageKey) {
    if (!storageKey.startsWith(`${id}/`)) {
      return NextResponse.json<UpdateResponse>(
        { ok: false, error: "Invalid upload reference." },
        { status: 400 }
      );
    }

    const size = await getObjectSize(storageKey);
    if (size == null) {
      return NextResponse.json<UpdateResponse>(
        { ok: false, error: "Uploaded file not found. Please retry the upload." },
        { status: 400 }
      );
    }

    const fileCheck = validateFilename(storageKey.slice(id.length + 1));
    if (!fileCheck.ok) {
      await removeObject(storageKey);
      return NextResponse.json<UpdateResponse>(
        { ok: false, error: fileCheck.error },
        { status: 400 }
      );
    }

    sizeBytes = size;
    type = fileCheck.type;
    previousStorageKey = await repo.getStorageKey(id);
  }

  const file = await repo.update(id, { ...result.value, storageKey, sizeBytes, type });
  if (!file) {
    if (storageKey) await removeObject(storageKey);
    return NextResponse.json<UpdateResponse>(
      { ok: false, error: "File not found." },
      { status: 404 }
    );
  }

  // Clean up the old object now that the row points at the new one.
  if (previousStorageKey && previousStorageKey !== storageKey) {
    await removeObject(previousStorageKey);
  }

  return NextResponse.json<UpdateResponse>({ ok: true, file });
});
