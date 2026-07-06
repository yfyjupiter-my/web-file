import { NextRequest, NextResponse } from "next/server";
import { checkPassword, isPlaceholderPassword, setSitePassword } from "@/lib/auth";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { parseJsonBody, requireSameOrigin, withAuth } from "@/lib/api-helpers";
import type { ChangePasswordPayload, ChangePasswordResponse } from "@/lib/types";

const MIN_PASSWORD_LENGTH = 8;

/** Best-effort client identifier for throttling — mirrors app/api/auth/route.ts. */
function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export const POST = withAuth(async (req: NextRequest) => {
  // CSRF defense-in-depth (SEC-4), same posture as the login route.
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const key = clientKey(req);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json<ChangePasswordResponse>(
      { ok: false, error: "Too many attempts. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      }
    );
  }

  const body = await parseJsonBody<ChangePasswordPayload>(req);
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json<ChangePasswordResponse>(
      { ok: false, error: "Missing current or new password." },
      { status: 400 }
    );
  }

  if (!(await checkPassword(currentPassword))) {
    recordFailure(key);
    return NextResponse.json<ChangePasswordResponse>(
      { ok: false, error: "Current password is incorrect." },
      { status: 401 }
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH || isPlaceholderPassword(newPassword)) {
    return NextResponse.json<ChangePasswordResponse>(
      { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  recordSuccess(key);
  try {
    await setSitePassword(newPassword);
  } catch (err) {
    console.error("[auth/change-password] failed to persist new password:", err);
    return NextResponse.json<ChangePasswordResponse>(
      { ok: false, error: "Couldn't save the new password. Storage isn't set up yet — try again later." },
      { status: 500 }
    );
  }
  return NextResponse.json<ChangePasswordResponse>({ ok: true });
});
