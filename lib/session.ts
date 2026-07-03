export const SESSION_COOKIE = "installer_vault_session";

/** Default session lifetime; mirrors the cookie `maxAge` set in /api/auth. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Signed session tokens (SEC-1).
 *
 * Format: `<payload>.<signature>` where
 *   payload   = base64url(JSON.stringify({ sid, exp }))
 *   signature = base64url(HMAC-SHA256(payload, COOKIE_SECRET))
 *
 * `sid` is a random per-session id (so two logins produce different tokens) and
 * `exp` is a unix-seconds expiry checked on every verify. The HMAC makes the
 * cookie unforgeable without the server-only `COOKIE_SECRET`.
 *
 * Implemented with the Web Crypto API (`crypto.subtle`) rather than node:crypto
 * so the exact same code runs in both the Edge runtime (middleware.ts) and the
 * Node runtime (isAuthenticated()).
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "COOKIE_SECRET is missing or too short (need >= 16 chars). Refusing to issue/verify sessions."
    );
  }
  return secret;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Issue a fresh signed session token. Throws if COOKIE_SECRET is unset. */
export async function createSessionToken(
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const key = await importKey(getSecret());
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const sid = crypto.randomUUID();
  const payload = base64urlEncode(encoder.encode(JSON.stringify({ sid, exp })));
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sig = base64urlEncode(new Uint8Array(sigBuf));
  return `${payload}.${sig}`;
}

/**
 * Verify a session token's signature and expiry. Fails closed (returns false)
 * on any malformed input, bad signature, expired token, or missing secret.
 */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = base64urlDecode(sig);
  } catch {
    return false;
  }

  try {
    const key = await importKey(secret);
    // crypto.subtle.verify does the constant-time comparison internally.
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
    if (!valid) return false;

    const claims = JSON.parse(decoder.decode(base64urlDecode(payload))) as {
      exp?: unknown;
    };
    if (typeof claims.exp !== "number") return false;
    return claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
