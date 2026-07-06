import { NextResponse } from "next/server";
import { withAuth, parseJsonBody, requireSameOrigin } from "@/lib/api-helpers";
import { getCategoriesRepo } from "@/lib/categories-repo";
import { validateCategoryName } from "@/lib/validation";
import type {
  CategoriesListResponse,
  CreateCategoryPayload,
  CreateCategoryResponse,
} from "@/lib/types";

export const GET = withAuth(async () => {
  const categories = await getCategoriesRepo().list();
  return NextResponse.json<CategoriesListResponse>({ categories });
});

export const POST = withAuth(async (req) => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const body = await parseJsonBody<Partial<CreateCategoryPayload>>(req);
  const check = validateCategoryName(body?.name);
  if (!check.ok) {
    return NextResponse.json<CreateCategoryResponse>(
      { ok: false, error: check.error },
      { status: 400 }
    );
  }

  const created = await getCategoriesRepo().create(check.value);
  if (!created) {
    return NextResponse.json<CreateCategoryResponse>(
      { ok: false, conflict: true, error: "That category already exists." },
      { status: 409 }
    );
  }

  return NextResponse.json<CreateCategoryResponse>({ ok: true, category: created });
});
