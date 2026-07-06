import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * Placeholder values that must never authenticate. If SITE_PASSWORD is still
 * one of these, the deployment hasn't set a real secret (SEC-3).
 */
export const PLACEHOLDER_PASSWORDS = ["changeme", "REPLACE_ME_BEFORE_DEPLOY"];

export function isPlaceholderPassword(value: string | undefined): boolean {
  return !value || PLACEHOLDER_PASSWORDS.includes(value);
}

/** Constant-time comparison to avoid timing attacks on the shared password (prd.md §4). */
function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  const sitePassword = process.env.SITE_PASSWORD ?? "";
  // Refuse the unset value and known placeholders so a misconfigured deploy
  // can never be unlocked with a well-known default (SEC-3).
  if (isPlaceholderPassword(sitePassword)) return false;
  return timingSafeEqual(candidate, sitePassword);
}

export async function isAuthenticated(): Promise<boolean> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export { SESSION_COOKIE };
