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
  // 32+ chars for an HMAC-SHA256 key; length is the floor, entropy is the
  // point — generate it randomly (see .env.example), don't type a phrase.
  if (!secret || secret.length < 32) {
    throw new Error(
      "COOKIE_SECRET is missing or too short (need >= 32 chars of random data). Refusing to issue/verify sessions."
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

/**
 * Issue a fresh signed session token. Throws if COOKIE_SECRET is unset.
 * `generation` is the current session generation (lib/auth.ts) — bumping it on
 * password change revokes every previously issued token.
 */
export async function createSessionToken(
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
  generation = 0
): Promise<string> {
  const key = await importKey(getSecret());
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const sid = crypto.randomUUID();
  const payload = base64urlEncode(encoder.encode(JSON.stringify({ sid, exp, gen: generation })));
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sig = base64urlEncode(new Uint8Array(sigBuf));
  return `${payload}.${sig}`;
}

/**
 * Verify a session token's signature and expiry. Fails closed (returns false)
 * on any malformed input, bad signature, expired token, or missing secret.
 *
 * Pass `expectedGeneration` to additionally require the token's `gen` claim to
 * match the current session generation (revocation on password change). The
 * middleware omits it — a cheap signature+expiry gate — while API routes and
 * the dashboard page enforce it via isAuthenticated().
 */
export async function verifySessionToken(
  token: string | undefined | null,
  expectedGeneration?: number
): Promise<boolean> {
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
      gen?: unknown;
    };
    if (typeof claims.exp !== "number") return false;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return false;
    if (expectedGeneration != null) {
      // Tokens minted before the gen claim existed count as generation 0.
      const gen = typeof claims.gen === "number" ? claims.gen : 0;
      if (gen !== expectedGeneration) return false;
    }
    return true;
  } catch {
    return false;
  }
}
