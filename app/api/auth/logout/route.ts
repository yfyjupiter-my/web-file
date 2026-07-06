import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

export async function POST() {
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
