import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
  _resetRateLimit,
} from "./rate-limit";

afterEach(() => _resetRateLimit());

describe("rate-limit", () => {
  it("allows an unseen key", () => {
    expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
  });

  it("allows the free tier of failures without blocking", () => {
    for (let i = 0; i < 5; i++) recordFailure("ip");
    expect(checkRateLimit("ip").allowed).toBe(true);
  });

  it("blocks with a retry delay once past the free tier", () => {
    for (let i = 0; i < 6; i++) recordFailure("ip");
    const res = checkRateLimit("ip");
    expect(res.allowed).toBe(false);
    expect(res.retryAfterMs).toBeGreaterThan(0);
  });

  it("grows the lockout exponentially", () => {
    for (let i = 0; i < 6; i++) recordFailure("ip");
    const first = checkRateLimit("ip").retryAfterMs;
    recordFailure("ip");
    const second = checkRateLimit("ip").retryAfterMs;
    expect(second).toBeGreaterThan(first);
  });

  it("clears state on success", () => {
    for (let i = 0; i < 8; i++) recordFailure("ip");
    expect(checkRateLimit("ip").allowed).toBe(false);
    recordSuccess("ip");
    expect(checkRateLimit("ip").allowed).toBe(true);
  });

  it("isolates keys from one another", () => {
    for (let i = 0; i < 8; i++) recordFailure("attacker");
    expect(checkRateLimit("attacker").allowed).toBe(false);
    expect(checkRateLimit("innocent").allowed).toBe(true);
  });

  it("blocks everyone once the global failure budget is spent (key rotation defense)", () => {
    // Simulate an attacker minting a fresh key (spoofed IP) per attempt.
    for (let i = 0; i < 30; i++) recordFailure(`fake-ip-${i}`);
    const res = checkRateLimit("yet-another-fresh-key");
    expect(res.allowed).toBe(false);
    expect(res.retryAfterMs).toBeGreaterThan(0);
  });

  it("does not clear the global bucket on a single key's success", () => {
    for (let i = 0; i < 30; i++) recordFailure(`fake-ip-${i}`);
    recordSuccess("fake-ip-0");
    expect(checkRateLimit("fresh-key").allowed).toBe(false);
  });
});
