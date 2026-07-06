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
 * Backed by the mock FilesRepo (lib/files-repo.ts) until Supabase is wired up.
 * Swapping to Supabase is a change to `getFilesRepo()`, not this handler.
 */
export const GET = withAuth(async () => {
  const files = await getFilesRepo().list();
  return NextResponse.json<FilesListResponse>({ files });
});

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
