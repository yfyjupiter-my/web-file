import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getFilesRepo } from "@/lib/files-repo";
import { validateName, validateFilename } from "@/lib/validation";
import { createUploadTarget } from "@/lib/storage";
import type { UploadUrlPayload, UploadUrlResponse } from "@/lib/types";

/**
 * Step 1 of the upload flow: validate the name/filename, reserve an id + object
 * path, and hand back a signed URL the browser PUTs the bytes to directly
 * (bypassing the serverless body limit — prd.md §5). The metadata row is only
 * written on the follow-up commit (POST /api/files) after the upload succeeds.
 */
export const POST = withAuth(async (req) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const body = await parseJsonBody<Partial<UploadUrlPayload>>(req);

  const nameCheck = validateName(body?.name);
  if (!nameCheck.ok) {
    return NextResponse.json<UploadUrlResponse>(
      { ok: false, error: nameCheck.error },
      { status: 400 }
    );
  }

  const fileCheck = validateFilename(body?.filename);
  if (!fileCheck.ok) {
    return NextResponse.json<UploadUrlResponse>(
      { ok: false, error: fileCheck.error },
      { status: 400 }
    );
  }

  // Reject early if the name is taken, before uploading any bytes.
  if (await getFilesRepo().findByName(nameCheck.value)) {
    return NextResponse.json<UploadUrlResponse>(
      { ok: false, conflict: true },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  const storageKey = `${id}/${fileCheck.safeName}`;
  const uploadUrl = await createUploadTarget(storageKey);

  return NextResponse.json<UploadUrlResponse>({ ok: true, id, storageKey, uploadUrl });
});
