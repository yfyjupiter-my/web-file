import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// isAuthenticated() calls next/headers cookies(); stub it so this stays a pure unit test.
const cookieStore = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

import { checkPassword, isAuthenticated, SESSION_COOKIE } from "./auth";

describe("checkPassword", () => {
  const original = process.env.SITE_PASSWORD;

  beforeEach(() => {
    process.env.SITE_PASSWORD = "s3cret";
  });

  afterEach(() => {
    process.env.SITE_PASSWORD = original;
  });

  it("accepts the correct password", () => {
    expect(checkPassword("s3cret")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(checkPassword("wrong")).toBe(false);
  });

  it("rejects a password of different length (no length oracle)", () => {
    expect(checkPassword("s3cre")).toBe(false);
    expect(checkPassword("s3cret-extra")).toBe(false);
  });

  it("rejects everything when SITE_PASSWORD is unset", () => {
    delete process.env.SITE_PASSWORD;
    expect(checkPassword("s3cret")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });
});

describe("isAuthenticated", () => {
  afterEach(() => cookieStore.clear());

  it("is true when the session cookie equals the expected value", () => {
    cookieStore.set(SESSION_COOKIE, { value: "1" });
    expect(isAuthenticated()).toBe(true);
  });

  it("is false when the cookie is absent", () => {
    expect(isAuthenticated()).toBe(false);
  });

  it("is false when the cookie has an unexpected value", () => {
    cookieStore.set(SESSION_COOKIE, { value: "0" });
    expect(isAuthenticated()).toBe(false);
  });
});
