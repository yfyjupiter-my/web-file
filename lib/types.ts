export type FileType = "EXE" | "MSI" | "DMG" | "ZIP" | "PKG";

export type Category =
  | "OS / Drivers"
  | "Productivity"
  | "Security / AV"
  | "Utilities"
  | "Uncategorized";

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

/** Client-supplied body for `POST /api/files`. All fields are untrusted input. */
export interface UploadPayload {
  name: string;
  category: string;
  version: string;
  notes?: string;
}

/** Response from `GET /api/files`. */
export interface FilesListResponse {
  files: InstallerFile[];
}

/** Response from `POST /api/files`. */
export interface UploadResponse {
  ok: boolean;
  conflict?: boolean;
  file?: InstallerFile;
  error?: string;
}
