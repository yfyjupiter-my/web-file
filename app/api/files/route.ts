import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { mockFiles } from "@/lib/mock-data";

/**
 * STUBBED: returns mock-data.ts instead of querying Supabase.
 * Swap the body for a `getSupabaseServerClient().from("files").select()`
 * call once the `files` table exists (see prd.md §4).
 */
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ files: mockFiles });
}

/**
 * STUBBED: logs the intended upload and echoes back a fake success.
 * Real implementation: validate type/size, upload to Supabase Storage,
 * upsert the metadata row (prd.md upload flow).
 */
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  console.log("[stub] would upload installer:", body);

  const nameExists = mockFiles.some(
    (f) => f.name.toLowerCase() === String(body?.name ?? "").toLowerCase()
  );

  if (nameExists) {
    return NextResponse.json({ ok: false, conflict: true }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
