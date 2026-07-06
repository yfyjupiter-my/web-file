import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "./auth";

type Handler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with the shared session guard. Returns 401 before the
 * handler runs if the request isn't authenticated, so individual handlers stay
 * focused on their own logic.
 */
export function withAuth(handler: Handler): Handler {
  return async (req: NextRequest) => {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req);
  };
}

/** Parse a JSON request body, returning null on malformed/missing input. */
export async function parseJsonBody<T = unknown>(
  req: NextRequest
): Promise<T | null> {
  return req.json().catch(() => null) as Promise<T | null>;
}
