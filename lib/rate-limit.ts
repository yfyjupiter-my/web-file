/**
 * Per-key login throttling for /api/auth (SEC-2).
 *
 * (A hard `import "server-only"` guard is added centrally in Phase 2 / P2.8.)
 *
 * A single shared password is the only defense on the gate, so brute force must
 * be slowed to a crawl. Callers get `FREE_ATTEMPTS` cheap failures, after which
 * each further failure imposes an exponentially growing lockout (capped at
 * `MAX_BLOCK_MS`). A success clears the counter.
 *
 * NOTE: this is an in-memory store, so limits are per-server-instance. It is the
 * right default for local/dev and single-instance deploys, but does NOT hold
 * across a horizontally-scaled/serverless fleet. Swap `store` for Upstash /
 * Vercel KV (same check/record/success surface) before scaling out — see
 * TASKS.md P1.2.
 */

interface Attempt {
  failures: number;
  blockedUntil: number; // epoch ms; 0 = not blocked
  lastSeen: number; // epoch ms; for eviction
}

const FREE_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const MAX_BLOCK_MS = 15 * 60 * 1_000; // 15 minutes
const IDLE_TTL_MS = 60 * 60 * 1_000; // forget a key after 1h of no activity
const MAX_KEYS = 10_000; // hard cap so a spray of unique IPs can't OOM us
const ALERT_THRESHOLD = FREE_ATTEMPTS * 4; // structured "alert" log past this many fails

const store = new Map<string, Attempt>();

/** Drop stale entries; called opportunistically so the map can't grow forever. */
function sweep(now: number): void {
  for (const [key, rec] of store) {
    if (rec.blockedUntil < now && now - rec.lastSeen > IDLE_TTL_MS) {
      store.delete(key);
    }
  }
  // If a burst of unique keys still overflows the cap, evict oldest-seen first.
  if (store.size > MAX_KEYS) {
    const sorted = [...store.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (let i = 0; i < sorted.length && store.size > MAX_KEYS; i++) {
      store.delete(sorted[i][0]);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/** Check whether `key` may attempt a login right now. Does not mutate state. */
export function checkRateLimit(key: string): RateLimitResult {
  const rec = store.get(key);
  if (!rec) return { allowed: true, retryAfterMs: 0 };
  const now = Date.now();
  if (rec.blockedUntil > now) {
    return { allowed: false, retryAfterMs: rec.blockedUntil - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Record a failed attempt and apply exponential backoff once past the free tier. */
export function recordFailure(key: string): void {
  const now = Date.now();
  const rec = store.get(key) ?? { failures: 0, blockedUntil: 0, lastSeen: now };
  rec.failures += 1;
  rec.lastSeen = now;

  if (rec.failures > FREE_ATTEMPTS) {
    const over = rec.failures - FREE_ATTEMPTS;
    const delay = Math.min(BASE_DELAY_MS * 2 ** (over - 1), MAX_BLOCK_MS);
    rec.blockedUntil = now + delay;
  }

  store.set(key, rec);

  if (rec.failures === ALERT_THRESHOLD) {
    // Lightweight alerting hook: never logs the attempted password.
    console.warn(
      `[auth] repeated failed logins for key=${key} (failures=${rec.failures}) — possible brute force`
    );
  }

  if (store.size > MAX_KEYS) sweep(now);
}

/** Clear a key's failure state after a successful login. */
export function recordSuccess(key: string): void {
  store.delete(key);
}

/** Test-only: reset all throttle state. */
export function _resetRateLimit(): void {
  store.clear();
}
