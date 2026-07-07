import { NextRequest, NextResponse } from "next/server";
import { checkPassword, getSessionGeneration } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/session";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { clientKey, requireSameOrigin } from "@/lib/api-helpers";
import type { AuthResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  // CSRF defense-in-depth (SEC-4) — reject positively cross-origin logins.
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const key = clientKey(req);

  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json<AuthResponse>(
      { ok: false, error: "Too many attempts. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  if (typeof password !== "string" || !(await checkPassword(password))) {
    recordFailure(key);
    return NextResponse.json<AuthResponse>({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  recordSuccess(key);

  const token = await createSessionToken(SESSION_MAX_AGE_SECONDS, await getSessionGeneration());
  const res = NextResponse.json<AuthResponse>({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
