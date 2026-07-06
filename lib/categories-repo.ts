import "server-only";

import { getSupabaseServerClient } from "./supabase";

/** Seed/fallback taxonomy — used by the mock repo and as the migration seed. */
const DEFAULT_CATEGORIES = [
  "OS / Drivers",
  "Productivity",
  "Security / AV",
  "Utilities",
  "Uncategorized",
];

/**
 * The single seam for reading/creating categories. Mirrors lib/files-repo.ts:
 * Supabase-backed when configured, otherwise an in-memory mock seeded from
 * `DEFAULT_CATEGORIES` so the UI runs without infra.
 */
export interface CategoriesRepo {
  /** All category names, in stable (creation) order. */
  list(): Promise<string[]>;
  /** Create a new category and return it, or null if it already exists. */
  create(name: string): Promise<string | null>;
}

class MockCategoriesRepo implements CategoriesRepo {
  private names: string[];

  constructor(seed: string[]) {
    this.names = [...seed];
  }

  async list(): Promise<string[]> {
    return [...this.names];
  }

  async create(name: string): Promise<string | null> {
    if (this.names.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return null;
    }
    this.names.push(name);
    return name;
  }
}

class SupabaseCategoriesRepo implements CategoriesRepo {
  async list(): Promise<string[]> {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("categories")
      .select("name")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`categories.list failed: ${error.message}`);
    return (data ?? []).map((r) => r.name as string);
  }

  async create(name: string): Promise<string | null> {
    const client = getSupabaseServerClient();
    const { error } = await client.from("categories").insert({ name });
    if (error) {
      // Unique-violation = already exists; treat as a no-op rather than an error.
      if (error.code === "23505") return null;
      throw new Error(`categories.create failed: ${error.message}`);
    }
    return name;
  }
}

let repo: CategoriesRepo | undefined;

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getCategoriesRepo(): CategoriesRepo {
  repo ??= isSupabaseConfigured()
    ? new SupabaseCategoriesRepo()
    : new MockCategoriesRepo(DEFAULT_CATEGORIES);
  return repo;
}
