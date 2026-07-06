export type FileType = "EXE" | "MSI" | "DMG" | "ZIP" | "PKG";

/**
 * Category names are a persisted, user-extensible list (see
 * lib/categories-repo.ts) rather than a closed set, so this is just `string`.
 */
export type Category = string;

export interface InstallerFile {
  id: string;
  name: string;
  type: FileType;
  category: Category;
  version: string;
  sizeLabel: string;
  uploadedAt: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// API contract types (shared by route handlers and client fetch calls).
// ---------------------------------------------------------------------------

/** Response from `POST /api/auth`. */
export interface AuthResponse {
  ok: boolean;
  error?: string;
}

/** Client-supplied metadata body for `POST /api/files`. All fields untrusted. */
export interface UploadPayload {
  name: string;
  category: string;
  version: string;
  notes?: string;
}

/** Body for `POST /api/files/upload-url` — step 1 of the upload flow. */
export interface UploadUrlPayload {
  name: string;
  filename: string;
}

/** Response from `POST /api/files/upload-url`. */
export interface UploadUrlResponse {
  ok: boolean;
  /** Absolute URL the browser PUTs the file bytes to (self-authorizing). */
  uploadUrl?: string;
  /** Pre-assigned id + object path to echo back on commit. */
  id?: string;
  storageKey?: string;
  conflict?: boolean;
  error?: string;
}

/** Commit body for `POST /api/files` — step 3, after the binary is uploaded. */
export interface UploadCommitPayload extends UploadPayload {
  id: string;
  storageKey: string;
  sizeBytes: number;
}

/** Response from `GET /api/files`. */
export interface FilesListResponse {
  files: InstallerFile[];
  /** Total rows matching (ignoring the page window), for building pagination. */
  total: number;
  /** Echoed page window; `limit` is null when the full set was returned. */
  limit: number | null;
  offset: number;
}

/** Response from `POST /api/files`. */
export interface UploadResponse {
  ok: boolean;
  conflict?: boolean;
  file?: InstallerFile;
  error?: string;
}

/** Response from `DELETE /api/files/:id`. */
export interface DeleteResponse {
  ok: boolean;
  error?: string;
}

/** Body for `PATCH /api/files/:id` — editable metadata only. */
export type UpdateFilePayload = UploadPayload;

/** Response from `PATCH /api/files/:id`. */
export interface UpdateResponse {
  ok: boolean;
  conflict?: boolean;
  file?: InstallerFile;
  error?: string;
}

/** Response from `GET /api/categories`. */
export interface CategoriesListResponse {
  categories: string[];
}

/** Body for `POST /api/categories`. */
export interface CreateCategoryPayload {
  name: string;
}

/** Response from `POST /api/categories`. */
export interface CreateCategoryResponse {
  ok: boolean;
  category?: string;
  conflict?: boolean;
  error?: string;
}
