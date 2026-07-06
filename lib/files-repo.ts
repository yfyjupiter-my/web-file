import "server-only";

import type { InstallerFile } from "./types";
import { mockFiles } from "./mock-data";

/**
 * The single seam between the app and its data source.
 *
 * Everything that reads or writes installer metadata goes through a
 * `FilesRepo`. Today the only implementation is the in-memory mock
 * (seeded from lib/mock-data.ts); when Supabase lands, add a
 * `SupabaseFilesRepo` and swap it in `getFilesRepo()` — no caller changes.
 */
export interface FilesRepo {
  /** All files, newest-first. */
  list(): Promise<InstallerFile[]>;
  /** Case-insensitive lookup by display name, or null if none. */
  findByName(name: string): Promise<InstallerFile | null>;
  /** Persist a new file and return the stored row. */
  create(input: NewFileInput): Promise<InstallerFile>;
}

/** Fields the caller supplies; the repo assigns id/type/size/timestamp. */
export interface NewFileInput {
  name: string;
  category: InstallerFile["category"];
  version: string;
  notes?: string;
}

/**
 * In-memory repository seeded from the mock fixtures.
 *
 * Note: state is per-process and non-durable — a server restart resets it,
 * and it is NOT shared across instances. That is fine for the demo/mock
 * stage; the Supabase implementation replaces it with a real table.
 */
class MockFilesRepo implements FilesRepo {
  private files: InstallerFile[];

  constructor(seed: InstallerFile[]) {
    // Copy the seed so we never mutate the exported fixture array.
    this.files = seed.map((f) => ({ ...f }));
  }

  async list(): Promise<InstallerFile[]> {
    return this.files.map((f) => ({ ...f }));
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

// Singleton so the in-memory writes from POST are visible to later GETs
// within the same server process.
let repo: FilesRepo | undefined;

export function getFilesRepo(): FilesRepo {
  repo ??= new MockFilesRepo(mockFiles);
  return repo;
}
