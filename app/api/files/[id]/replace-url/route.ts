import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { validateFilename } from "@/lib/validation";
import { createUploadTarget } from "@/lib/storage";
import type { ReplaceUrlPayload, ReplaceUrlResponse } from "@/lib/types";

/**
 * Step 1 of replacing an existing installer's binary: validate the filename,
 * mint an object path under the *same* file id, and hand back a signed URL the
 * browser PUTs the bytes to directly (mirrors upload-url, but reuses the id
 * instead of minting a new one so the row/version history stays put).
 */
export const POST = withAuth(async (req) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const segments = req.nextUrl.pathname.split("/");
  const id = segments[segments.length - 2] ?? "";

  const existing = await getFilesRepo().getStorageKey(id);
  if (existing == null) {
    return NextResponse.json<ReplaceUrlResponse>(
      { ok: false, error: "File not found." },
      { status: 404 }
    );
  }

  const body = await parseJsonBody<Partial<ReplaceUrlPayload>>(req);
  const fileCheck = validateFilename(body?.filename);
  if (!fileCheck.ok) {
    return NextResponse.json<ReplaceUrlResponse>(
      { ok: false, error: fileCheck.error },
      { status: 400 }
    );
  }

  const storageKey = `${id}/${fileCheck.safeName}`;
  const uploadUrl = await createUploadTarget(storageKey);

  return NextResponse.json<ReplaceUrlResponse>({ ok: true, storageKey, uploadUrl });
});
