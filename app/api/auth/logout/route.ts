import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { requireSameOrigin } from "@/lib/api-helpers";
import type { AuthResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  // CSRF defense-in-depth (SEC-4): worst case is only a forced logout, but
  // there's no reason to let another origin trigger even that.
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const res = NextResponse.json<AuthResponse>({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
