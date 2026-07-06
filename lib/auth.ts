import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { getSettingsRepo } from "./settings-repo";

/**
 * Placeholder values that must never authenticate. If SITE_PASSWORD is still
 * one of these, the deployment hasn't set a real secret (SEC-3).
 */
export const PLACEHOLDER_PASSWORDS = ["changeme", "REPLACE_ME_BEFORE_DEPLOY"];

/** Settings-repo key for the persisted password override (see setSitePassword). */
const PASSWORD_HASH_KEY = "site_password_hash";

const SCRYPT_KEYLEN = 64;

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

/** Hash a password as `<salt-hex>:<hash-hex>` for storage (settings-repo). */
function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt.toString("hex")}:${derivedKey.toString("hex")}`);
    });
  });
}

/** Verify a candidate password against a `<salt-hex>:<hash-hex>` stored hash. */
function verifyPasswordHash(candidate: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return Promise.resolve(false);
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(candidate, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.length === expected.length && crypto.timingSafeEqual(derivedKey, expected));
    });
  });
}

/**
 * Checks a candidate against the effective site password: a persisted
 * override (set via setSitePassword, e.g. from Settings → Change Password)
 * takes precedence over the `SITE_PASSWORD` env var, which remains the
 * deploy-time default.
 */
export async function checkPassword(candidate: string): Promise<boolean> {
  // The override lookup must never take down the whole login gate — e.g. if
  // migration 0002 (app_settings) hasn't been applied yet, fall back to
  // SITE_PASSWORD rather than throwing out of every auth check.
  let stored: string | null = null;
  try {
    stored = await getSettingsRepo().get(PASSWORD_HASH_KEY);
  } catch (err) {
    console.warn("[auth] settings-repo lookup failed, falling back to SITE_PASSWORD:", err);
  }
  if (stored) return verifyPasswordHash(candidate, stored);

  const sitePassword = process.env.SITE_PASSWORD ?? "";
  // Refuse the unset value and known placeholders so a misconfigured deploy
  // can never be unlocked with a well-known default (SEC-3).
  if (isPlaceholderPassword(sitePassword)) return false;
  return timingSafeEqual(candidate, sitePassword);
}

/** Persist a new site password, superseding SITE_PASSWORD from now on. */
export async function setSitePassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await getSettingsRepo().set(PASSWORD_HASH_KEY, hash);
}

export async function isAuthenticated(): Promise<boolean> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}
