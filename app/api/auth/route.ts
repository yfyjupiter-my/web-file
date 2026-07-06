import { NextRequest, NextResponse } from "next/server";
import { checkPassword } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/session";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rate-limit";
import type { AuthResponse } from "@/lib/types";

/** Best-effort client identifier for throttling. Falls back to a shared bucket. */
function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
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

  if (typeof password !== "string" || !checkPassword(password)) {
    recordFailure(key);
    return NextResponse.json<AuthResponse>({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  recordSuccess(key);

  const token = await createSessionToken();
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
