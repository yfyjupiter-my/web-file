import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { getCategoriesRepo } from "@/lib/categories-repo";
import {
  isUuid,
  validateUploadPayload,
  validateFilename,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "@/lib/validation";
import { getObjectSize, removeObject } from "@/lib/storage";
import type {
  FilesListResponse,
  UploadCommitPayload,
  UploadResponse,
} from "@/lib/types";

/**
 * Backed by whichever FilesRepo `getFilesRepo()` returns (Supabase when
 * configured, otherwise the in-memory mock).
 *
 * P4.2 — supports `?limit=&offset=` pagination (indexed, newest-first) and
 * sends short private caching headers. Auth-gated data stays `private`; SWR
 * lets a client reuse a slightly stale page while revalidating.
 */
const MAX_LIMIT = 100;

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const limit = parseIntParam(searchParams.get("limit"));
  const offset = parseIntParam(searchParams.get("offset")) ?? 0;

  const { files, total } = await getFilesRepo().list(
    limit != null ? { limit: Math.min(limit, MAX_LIMIT), offset } : undefined
  );

  return NextResponse.json<FilesListResponse>(
    { files, total, limit: limit != null ? Math.min(limit, MAX_LIMIT) : null, offset },
    {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    }
  );
});

/** Parse a non-negative integer query param, or null if absent/invalid. */
function parseIntParam(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Step 3 (commit) of the upload flow: the binary has already been PUT to Storage
 * via the signed URL from POST /api/files/upload-url. Here we validate the
 * metadata, confirm the object really exists (reading its authoritative size),
 * and write the row. On any post-upload failure we delete the orphaned object.
 */
export const POST = withAuth(async (req) => {
  // CSRF defense-in-depth on top of the SameSite=Lax session cookie (SEC-4).
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const body = await parseJsonBody<Partial<UploadCommitPayload>>(req);

  const validCategories = await getCategoriesRepo().list();
  const result = validateUploadPayload(body, validCategories);
  if (!result.ok) {
    return NextResponse.json<UploadResponse>(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  const id = String(body?.id ?? "");
  const storageKey = String(body?.storageKey ?? "");
  // Bind the object path to the id so a caller can't commit an unrelated path.
  if (!isUuid(id) || !storageKey.startsWith(`${id}/`)) {
    return NextResponse.json<UploadResponse>(
      { ok: false, error: "Invalid upload reference." },
      { status: 400 }
    );
  }

  // Trust Storage, not the client, for the size — and reject a missing object.
  const size = await getObjectSize(storageKey);
  if (size == null) {
    return NextResponse.json<UploadResponse>(
      { ok: false, error: "Uploaded file not found. Please retry the upload." },
      { status: 400 }
    );
  }
  if (size > MAX_UPLOAD_BYTES) {
    await removeObject(storageKey);
    return NextResponse.json<UploadResponse>(
      { ok: false, error: `File exceeds the ${MAX_UPLOAD_MB}MB limit.` },
      { status: 400 }
    );
  }

  // Re-derive the type from the stored filename (don't trust a client-sent type).
  const fileCheck = validateFilename(storageKey.slice(id.length + 1));
  if (!fileCheck.ok) {
    await removeObject(storageKey);
    return NextResponse.json<UploadResponse>(
      { ok: false, error: fileCheck.error },
      { status: 400 }
    );
  }

  const repo = getFilesRepo();
  if (await repo.findByName(result.value.name)) {
    await removeObject(storageKey);
    return NextResponse.json<UploadResponse>(
      { ok: false, conflict: true },
      { status: 409 }
    );
  }

  try {
    const file = await repo.create({
      ...result.value,
      id,
      storageKey,
      sizeBytes: size,
      type: fileCheck.type,
    });
    return NextResponse.json<UploadResponse>({ ok: true, file });
  } catch {
    // Unique-index race or insert failure — don't leave an orphaned object.
    await removeObject(storageKey);
    return NextResponse.json<UploadResponse>(
      { ok: false, error: "Could not save the file. Please retry." },
      { status: 409 }
    );
  }
});
