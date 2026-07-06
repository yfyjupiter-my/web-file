import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { requireSameOrigin } from "./api-helpers";

function reqWith(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("requireSameOrigin", () => {
  it("allows same-origin via Sec-Fetch-Site", () => {
    expect(requireSameOrigin(reqWith({ "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(requireSameOrigin(reqWith({ "sec-fetch-site": "same-site" }))).toBeNull();
    expect(requireSameOrigin(reqWith({ "sec-fetch-site": "none" }))).toBeNull();
  });

  it("blocks cross-site via Sec-Fetch-Site", () => {
    const res = requireSameOrigin(reqWith({ "sec-fetch-site": "cross-site" }));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("falls back to Origin/Host comparison", () => {
    expect(
      requireSameOrigin(reqWith({ origin: "https://vault.example", host: "vault.example" }))
    ).toBeNull();
    const res = requireSameOrigin(
      reqWith({ origin: "https://evil.example", host: "vault.example" })
    );
    expect(res?.status).toBe(403);
  });

  it("allows requests with no origin signals (non-browser clients)", () => {
    expect(requireSameOrigin(reqWith({}))).toBeNull();
  });
});
