import { isCategory } from "./categories";
import type { NewFileInput } from "./files-repo";
import type { FileType, UploadPayload } from "./types";

/** Field limits for upload metadata (SEC-6). */
export const UPLOAD_LIMITS = {
  nameMax: 80,
  versionMax: 40,
  notesMax: 500,
} as const;

/**
 * Max upload size. The hard backstop is the Supabase project's *global* Storage
 * limit (50MB on the free tier); raise both together when moving to a paid plan
 * that allows larger installers (prd.md targets up to 500MB).
 */
export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Accepted installer extensions → the stored FileType (AC in prd.md §2).
const EXT_TO_TYPE: Record<string, FileType> = {
  exe: "EXE",
  msi: "MSI",
  dmg: "DMG",
  zip: "ZIP",
  pkg: "PKG",
};

/** Human list of accepted extensions, for error/UI copy. */
export const ALLOWED_EXTENSIONS = Object.keys(EXT_TO_TYPE).map((e) => `.${e}`).join(", ");

export type FilenameResult =
  | { ok: true; type: FileType; safeName: string }
  | { ok: false; error: string };

/**
 * Validate an uploaded file's name: derive the FileType from its extension and
 * produce a storage-safe basename. The storage key is always `${uuid}/${safeName}`,
 * so this can never introduce path traversal — but we still sanitize (P3.1).
 */
export function validateFilename(filename: unknown): FilenameResult {
  const raw = String(filename ?? "").trim();
  if (!raw) return { ok: false, error: "A file is required." };

  const dot = raw.lastIndexOf(".");
  const ext = dot === -1 ? "" : raw.slice(dot + 1).toLowerCase();
  const type = EXT_TO_TYPE[ext];
  if (!type) {
    return { ok: false, error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS}.` };
  }

  const base =
    raw.slice(0, dot).replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80) || "file";
  return { ok: true, type, safeName: `${base}.${ext}` };
}

// Display name: letters/numbers/spaces and a conservative punctuation set.
// Deliberately excludes path separators (`/` `\`) and control chars so a name
// can never be turned into a storage path (path-traversal defense — P3.1/CODE-40).
const NAME_RE = /^[\p{L}\p{N} ._()+#&·-]+$/u;
// Version/date label: alphanumerics plus dot, space, comma, slash, dashes.
const VERSION_RE = /^[\p{L}\p{N} .,/·-]*$/u;

export type ValidationResult =
  | { ok: true; value: NewFileInput }
  | { ok: false; error: string };

/**
 * Validate and normalize an untrusted upload payload into a `NewFileInput`.
 * Returns a typed error string (safe to surface to the client) on any failure.
 */
/** Validate/normalize just the display name (shared by upload-url + commit). */
export function validateName(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > UPLOAD_LIMITS.nameMax) {
    return { ok: false, error: `Name must be ${UPLOAD_LIMITS.nameMax} characters or fewer.` };
  }
  if (!NAME_RE.test(name)) {
    return { ok: false, error: "Name contains unsupported characters." };
  }
  return { ok: true, value: name };
}

export function validateUploadPayload(body: Partial<UploadPayload> | null): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Missing request body." };
  }

  const nameCheck = validateName(body.name);
  if (!nameCheck.ok) return nameCheck;
  const name = nameCheck.value;

  const category = String(body.category ?? "");
  if (!isCategory(category)) {
    return { ok: false, error: "Invalid category." };
  }

  const version = String(body.version ?? "").trim();
  if (version.length > UPLOAD_LIMITS.versionMax) {
    return { ok: false, error: `Version must be ${UPLOAD_LIMITS.versionMax} characters or fewer.` };
  }
  if (!VERSION_RE.test(version)) {
    return { ok: false, error: "Version contains unsupported characters." };
  }

  const rawNotes = body.notes;
  let notes: string | undefined;
  if (rawNotes != null && String(rawNotes).trim() !== "") {
    notes = String(rawNotes);
    if (notes.length > UPLOAD_LIMITS.notesMax) {
      return { ok: false, error: `Notes must be ${UPLOAD_LIMITS.notesMax} characters or fewer.` };
    }
  }

  return { ok: true, value: { name, category, version, notes } };
}
