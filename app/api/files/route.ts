import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { validateUploadPayload } from "@/lib/validation";
import type {
  FilesListResponse,
  UploadPayload,
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
 * Persists the upload metadata through the repo so the new file shows up in a
 * subsequent GET (the grid). Storage of the actual binary is still stubbed.
 */
export const POST = withAuth(async (req) => {
  // CSRF defense-in-depth on top of the SameSite=Lax session cookie (SEC-4).
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const body = await parseJsonBody<Partial<UploadPayload>>(req);

  const result = validateUploadPayload(body);
  if (!result.ok) {
    return NextResponse.json<UploadResponse>(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  const repo = getFilesRepo();

  if (await repo.findByName(result.value.name)) {
    return NextResponse.json<UploadResponse>(
      { ok: false, conflict: true },
      { status: 409 }
    );
  }

  const file = await repo.create(result.value);
  return NextResponse.json<UploadResponse>({ ok: true, file });
});
