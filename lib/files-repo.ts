import "server-only";

import type { InstallerFile } from "./types";
import { mockFiles } from "./mock-data";
import { getSupabaseServerClient } from "./supabase";

/**
 * The single seam between the app and its data source.
 *
 * Everything that reads or writes installer metadata goes through a
 * `FilesRepo`. `getFilesRepo()` returns the Supabase-backed implementation
 * when the environment is configured, and otherwise falls back to the
 * in-memory mock (seeded from lib/mock-data.ts) so the UI runs without infra.
 */
export interface FilesRepo {
  /**
   * Files newest-first. Pass `limit`/`offset` to page (P4.2); omit for all.
   * Always returns the matching `total` so callers can build pagination.
   */
  list(opts?: ListOptions): Promise<ListResult>;
  /** Case-insensitive lookup by display name, or null if none. */
  findByName(name: string): Promise<InstallerFile | null>;
  /** Persist a new file and return the stored row. */
  create(input: NewFileInput): Promise<InstallerFile>;
}

/** Pagination window for `list()`. Omit `limit` to fetch everything. */
export interface ListOptions {
  limit?: number;
  offset?: number;
}

/** `list()` result: the page of rows plus the unpaginated total count. */
export interface ListResult {
  files: InstallerFile[];
  total: number;
}

/** Fields the caller supplies; the repo assigns id/type/size/timestamp. */
export interface NewFileInput {
  name: string;
  category: InstallerFile["category"];
  version: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// In-memory mock
// ---------------------------------------------------------------------------

/**
 * In-memory repository seeded from the mock fixtures.
 *
 * Note: state is per-process and non-durable — a server restart resets it,
 * and it is NOT shared across instances. Used only when Supabase env vars are
 * absent; the SupabaseFilesRepo replaces it with a real table.
 */
class MockFilesRepo implements FilesRepo {
  private files: InstallerFile[];

  constructor(seed: InstallerFile[]) {
    // Copy the seed so we never mutate the exported fixture array.
    this.files = seed.map((f) => ({ ...f }));
  }

  async list(opts?: ListOptions): Promise<ListResult> {
    const total = this.files.length;
    const start = opts?.offset ?? 0;
    const end = opts?.limit != null ? start + opts.limit : undefined;
    const page = this.files.slice(start, end).map((f) => ({ ...f }));
    return { files: page, total };
  }

  async findByName(name: string): Promise<InstallerFile | null> {
    const target = name.trim().toLowerCase();
    const found = this.files.find((f) => f.name.toLowerCase() === target);
    return found ? { ...found } : null;
  }

  async create(input: NewFileInput): Promise<InstallerFile> {
    const file: InstallerFile = {
      // Server-generated UUID. Any future storage key derives from this, never
      // from the user-supplied name — prevents path traversal (SEC-6/P3.1).
      id: crypto.randomUUID(),
      name: input.name,
      // Demo storage doesn't inspect the binary, so type/size are placeholders.
      type: "EXE",
      category: input.category,
      version: input.version || "—",
      sizeLabel: "—",
      uploadedAt: new Date().toISOString().slice(0, 10),
      notes: input.notes,
    };
    this.files.unshift(file);
    return { ...file };
  }
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

/** Columns selected from `public.files` (snake_case, DB shape). */
const COLS = "id,name,type,category,version,size_label,uploaded_at,notes";

/** DB row shape returned by the selects above. */
interface FileRow {
  id: string;
  name: string;
  type: string;
  category: string;
  version: string;
  size_label: string;
  uploaded_at: string;
  notes: string | null;
}

/** Map a snake_case DB row to the camelCase `InstallerFile` the app uses. */
function mapRow(r: FileRow): InstallerFile {
  return {
    id: r.id,
    name: r.name,
    type: r.type as InstallerFile["type"],
    category: r.category as InstallerFile["category"],
    version: r.version,
    sizeLabel: r.size_label,
    // Column is timestamptz; the UI only shows the calendar date.
    uploadedAt: String(r.uploaded_at).slice(0, 10),
    notes: r.notes ?? undefined,
  };
}

/**
 * Supabase-backed repository. Uses the service-role client (bypasses RLS by
 * design — ADR 0001) over the REST API.
 */
class SupabaseFilesRepo implements FilesRepo {
  async list(opts?: ListOptions): Promise<ListResult> {
    const client = getSupabaseServerClient();
    // `count: 'exact'` returns the unpaginated total alongside the page.
    let query = client
      .from("files")
      .select(COLS, { count: "exact" })
      .order("uploaded_at", { ascending: false });

    if (opts?.limit != null) {
      const start = opts.offset ?? 0;
      query = query.range(start, start + opts.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`files.list failed: ${error.message}`);
    return { files: (data ?? []).map(mapRow), total: count ?? 0 };
  }

  async findByName(name: string): Promise<InstallerFile | null> {
    const client = getSupabaseServerClient();
    // P4.1 — indexed exact match on the stored lower(name) column (unique index
    // files_name_lower_uniq). Never pulls the whole table to check a name.
    const { data, error } = await client
      .from("files")
      .select(COLS)
      .eq("name_lower", name.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`files.findByName failed: ${error.message}`);
    return data ? mapRow(data as FileRow) : null;
  }

  async create(input: NewFileInput): Promise<InstallerFile> {
    const client = getSupabaseServerClient();
    // Server-generated id; storage_key derives from it, never the name (P3.1).
    const id = crypto.randomUUID();
    const { data, error } = await client
      .from("files")
      .insert({
        id,
        name: input.name,
        type: "EXE",
        category: input.category,
        version: input.version || "—",
        size_label: "—",
        notes: input.notes ?? null,
        storage_key: id,
      })
      .select(COLS)
      .single();

    if (error) throw new Error(`files.create failed: ${error.message}`);
    return mapRow(data as FileRow);
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

// Singleton so the mock's in-memory writes survive across requests in one
// process, and so we reuse a single repo instance.
let repo: FilesRepo | undefined;

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getFilesRepo(): FilesRepo {
  repo ??= isSupabaseConfigured()
    ? new SupabaseFilesRepo()
    : new MockFilesRepo(mockFiles);
  return repo;
}
