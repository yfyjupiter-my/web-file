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

/**
 * Settings-repo key for the session generation. Bumped on every password
 * change so all previously issued session tokens stop verifying (session
 * revocation — SEC audit 2026-07-07).
 */
const SESSION_GENERATION_KEY = "session_generation";

/** How long a fetched generation may be reused before re-reading the store. */
const GENERATION_CACHE_TTL_MS = 60_000;

const SCRYPT_KEYLEN = 64;

// Last password hash this process successfully read (null = "no override
// stored"). Lets a *transient* settings-store outage verify against the value
// we already saw instead of resurrecting the superseded SITE_PASSWORD env var
// (BUS audit 2026-07-07). `undefined` = never read successfully.
let lastKnownHash: string | null | undefined;

let cachedGeneration: { value: number; fetchedAt: number } | undefined;

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
  // migration 0005 (app_settings) hasn't been applied yet, fall back rather
  // than throwing out of every auth check.
  let stored: string | null = null;
  let lookupFailed = false;
  try {
    stored = await getSettingsRepo().get(PASSWORD_HASH_KEY);
    lastKnownHash = stored;
  } catch (err) {
    lookupFailed = true;
    console.warn("[auth] settings-repo lookup failed:", err);
  }

  // Transient outage after we've already seen the store: verify against the
  // last-known value instead of re-enabling a superseded SITE_PASSWORD. Only a
  // never-successful lookup (fresh process during an outage, or app_settings
  // not migrated yet) falls through to the env var.
  if (lookupFailed && lastKnownHash !== undefined) {
    stored = lastKnownHash;
  }
  if (stored) return verifyPasswordHash(candidate, stored);

  const sitePassword = process.env.SITE_PASSWORD ?? "";
  // Refuse the unset value and known placeholders so a misconfigured deploy
  // can never be unlocked with a well-known default (SEC-3).
  if (isPlaceholderPassword(sitePassword)) return false;
  return timingSafeEqual(candidate, sitePassword);
}

/**
 * Current session generation (0 until a password change bumps it). Cached
 * briefly so every authenticated request doesn't cost a settings read; after
 * a bump, other instances converge within GENERATION_CACHE_TTL_MS.
 */
export async function getSessionGeneration(): Promise<number> {
  const now = Date.now();
  if (cachedGeneration && now - cachedGeneration.fetchedAt < GENERATION_CACHE_TTL_MS) {
    return cachedGeneration.value;
  }
  try {
    const raw = await getSettingsRepo().get(SESSION_GENERATION_KEY);
    const value = raw ? Number.parseInt(raw, 10) || 0 : 0;
    cachedGeneration = { value, fetchedAt: now };
    return value;
  } catch (err) {
    console.warn("[auth] session-generation lookup failed:", err);
    // Fail open to the last-seen (or initial) generation: a settings outage
    // shouldn't log everyone out; revocation resumes when the store is back.
    return cachedGeneration?.value ?? 0;
  }
}

/**
 * Persist a new site password, superseding SITE_PASSWORD from now on, and bump
 * the session generation so every existing session token is revoked. Callers
 * should issue the requester a fresh token afterwards.
 */
export async function setSitePassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await getSettingsRepo().set(PASSWORD_HASH_KEY, hash);
  lastKnownHash = hash;

  const next = (await getSessionGeneration()) + 1;
  await getSettingsRepo().set(SESSION_GENERATION_KEY, String(next));
  cachedGeneration = { value: next, fetchedAt: Date.now() };
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, await getSessionGeneration());
}
