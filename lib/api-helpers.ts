import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "./auth";

/** Next's second route-handler argument; `params` is a Promise since Next 15. */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

type Handler = (
  req: NextRequest,
  context: RouteContext
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with the shared session guard. Returns 401 before the
 * handler runs if the request isn't authenticated, so individual handlers stay
 * focused on their own logic. Passes Next's route context through so handlers
 * can read `await context.params` instead of re-parsing the pathname.
 */
export function withAuth(handler: Handler): Handler {
  return async (req: NextRequest, context: RouteContext) => {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, context);
  };
}

/**
 * Whether proxy-supplied client-IP headers can be believed. On managed
 * platforms (Vercel sets `VERCEL`) the platform strips/overwrites inbound
 * `X-Forwarded-For`, so it's trustworthy. Anywhere else it's attacker-typed
 * unless the deployer explicitly vouches for their reverse proxy via
 * TRUST_PROXY=true.
 */
function trustProxyHeaders(): boolean {
  const flag = process.env.TRUST_PROXY;
  if (flag != null && flag !== "") {
    return flag === "1" || flag.toLowerCase() === "true";
  }
  return Boolean(process.env.VERCEL);
}

/**
 * Best-effort client identifier for throttling. Uses proxy headers only when
 * they're trustworthy (see trustProxyHeaders) — otherwise every direct client
 * shares one bucket and the global rate-limit bucket (lib/rate-limit.ts)
 * carries the brute-force defense.
 */
export function clientKey(req: NextRequest): string {
  if (trustProxyHeaders()) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "direct";
}

/** Parse a JSON request body, returning null on malformed/missing input. */
export async function parseJsonBody<T = unknown>(
  req: NextRequest
): Promise<T | null> {
  return req.json().catch(() => null) as Promise<T | null>;
}

/**
 * CSRF defense-in-depth (SEC-4). Returns a 403 response when the request is
 * *positively* cross-origin, or null when it's same-origin or indeterminate.
 *
 * Layered on top of the SameSite=Lax session cookie: we use `Sec-Fetch-Site`
 * when the browser sends it, and fall back to comparing the `Origin` host with
 * the request `Host`. Non-browser clients (no `Sec-Fetch-Site`, no `Origin`)
 * can't be classified as cross-origin, so they pass this layer and remain
 * gated by auth + SameSite.
 */
export function requireSameOrigin(req: NextRequest): NextResponse | null {
  const forbidden = () =>
    NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) {
    // "same-origin"/"same-site" are trusted; "none" = direct navigation (no POST
    // body from another site); "cross-site" is the CSRF case we block.
    return secFetchSite === "cross-site" ? forbidden() : null;
  }

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const host = req.headers.get("host");
      return new URL(origin).host === host ? null : forbidden();
    } catch {
      return forbidden();
    }
  }

  return null;
}
