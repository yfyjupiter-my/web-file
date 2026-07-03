import { cookies } from "next/headers";
import crypto from "crypto";
import { SESSION_COOKIE } from "./session";

/** Constant-time comparison to avoid timing attacks on the shared password (prd.md §4). */
function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  const sitePassword = process.env.SITE_PASSWORD ?? "";
  if (!sitePassword) return false;
  return timingSafeEqual(candidate, sitePassword);
}

export function isAuthenticated(): boolean {
  return cookies().get(SESSION_COOKIE)?.value === "1";
}

export { SESSION_COOKIE };
