import { NextResponse } from "next/server";
import { withAuth, parseJsonBody } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { isCategory } from "@/lib/categories";
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
  const body = await parseJsonBody<Partial<UploadPayload>>(req);

  const name = String(body?.name ?? "").trim();
  const category = String(body?.category ?? "");
  const version = String(body?.version ?? "").trim();
  const notes = body?.notes ? String(body.notes) : undefined;

  if (!name || !isCategory(category)) {
    return NextResponse.json<UploadResponse>(
      { ok: false, error: "Invalid name or category." },
      { status: 400 }
    );
  }

  const repo = getFilesRepo();

  if (await repo.findByName(name)) {
    return NextResponse.json<UploadResponse>(
      { ok: false, conflict: true },
      { status: 409 }
    );
  }

  const file = await repo.create({ name, category, version, notes });
  return NextResponse.json<UploadResponse>({ ok: true, file });
});
