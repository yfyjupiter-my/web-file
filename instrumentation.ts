/**
 * Boot-time environment validation (SEC-3). Next.js calls `register()` once at
 * server startup. We fail fast in production if critical secrets are unset or
 * still placeholders, and warn loudly in dev so misconfig is obvious.
 *
 * Kept dependency-light (no imports of server-only modules) so it runs cleanly
 * in whichever runtime instrumentation is loaded in.
 */

const PLACEHOLDER_PASSWORDS = ["", "changeme", "REPLACE_ME_BEFORE_DEPLOY"];

export async function register() {
  const problems: string[] = [];

  const sitePassword = process.env.SITE_PASSWORD ?? "";
  if (PLACEHOLDER_PASSWORDS.includes(sitePassword)) {
    problems.push("SITE_PASSWORD is unset or still a placeholder.");
  }

  const cookieSecret = process.env.COOKIE_SECRET ?? "";
  if (cookieSecret.length < 32) {
    problems.push("COOKIE_SECRET is unset or too short (need >= 32 chars of random data).");
  }

  if (problems.length === 0) return;

  const message = `[env] Insecure configuration:\n  - ${problems.join("\n  - ")}`;

  if (process.env.NODE_ENV === "production") {
    // Refuse to boot with placeholder/insecure secrets in production.
    throw new Error(`${message}\nRefusing to start. Set real values before deploying.`);
  }

  console.warn(`${message}\nSet real values before deploying.`);
}
