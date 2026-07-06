import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// isAuthenticated() calls next/headers cookies(); stub it so this stays a pure unit test.
const cookieStore = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

import { checkPassword, isAuthenticated, setSitePassword } from "./auth";
import { createSessionToken, SESSION_COOKIE } from "./session";

describe("checkPassword", () => {
  const original = process.env.SITE_PASSWORD;

  beforeEach(() => {
    process.env.SITE_PASSWORD = "s3cret";
  });

  afterEach(() => {
    process.env.SITE_PASSWORD = original;
  });

  it("accepts the correct password", async () => {
    expect(await checkPassword("s3cret")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    expect(await checkPassword("wrong")).toBe(false);
  });

  it("rejects a password of different length (no length oracle)", async () => {
    expect(await checkPassword("s3cre")).toBe(false);
    expect(await checkPassword("s3cret-extra")).toBe(false);
  });

  it("rejects everything when SITE_PASSWORD is unset", async () => {
    delete process.env.SITE_PASSWORD;
    expect(await checkPassword("s3cret")).toBe(false);
    expect(await checkPassword("")).toBe(false);
  });

  it("a persisted override (setSitePassword) supersedes SITE_PASSWORD", async () => {
    await setSitePassword("n3wpass");
    expect(await checkPassword("n3wpass")).toBe(true);
    expect(await checkPassword("s3cret")).toBe(false);
  });
});

describe("isAuthenticated", () => {
  const originalSecret = process.env.COOKIE_SECRET;

  beforeEach(() => {
    process.env.COOKIE_SECRET = "unit-test-cookie-secret-0123456789";
  });

  afterEach(() => {
    cookieStore.clear();
    process.env.COOKIE_SECRET = originalSecret;
  });

  it("is true for a valid signed token", async () => {
    cookieStore.set(SESSION_COOKIE, { value: await createSessionToken() });
    expect(await isAuthenticated()).toBe(true);
  });

  it("is false when the cookie is absent", async () => {
    expect(await isAuthenticated()).toBe(false);
  });

  it("rejects the legacy forgeable value \"1\" (SEC-1 regression)", async () => {
    cookieStore.set(SESSION_COOKIE, { value: "1" });
    expect(await isAuthenticated()).toBe(false);
  });

  it("rejects a token with a tampered payload", async () => {
    const token = await createSessionToken();
    const [, sig] = token.split(".");
    // Re-encode a different payload but keep the original signature.
    const forged = `${Buffer.from(JSON.stringify({ sid: "x", exp: 9_999_999_999 }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")}.${sig}`;
    cookieStore.set(SESSION_COOKIE, { value: forged });
    expect(await isAuthenticated()).toBe(false);
  });

  it("rejects an expired token", async () => {
    cookieStore.set(SESSION_COOKIE, { value: await createSessionToken(-10) });
    expect(await isAuthenticated()).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.COOKIE_SECRET = "a-completely-different-secret-value";
    cookieStore.set(SESSION_COOKIE, { value: token });
    expect(await isAuthenticated()).toBe(false);
  });

  it("fails closed when COOKIE_SECRET is unset", async () => {
    const token = await createSessionToken();
    delete process.env.COOKIE_SECRET;
    cookieStore.set(SESSION_COOKIE, { value: token });
    expect(await isAuthenticated()).toBe(false);
  });
});
