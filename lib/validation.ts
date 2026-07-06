import { isCategory } from "./categories";
import type { NewFileInput } from "./files-repo";
import type { UploadPayload } from "./types";

/** Field limits for upload metadata (SEC-6). */
export const UPLOAD_LIMITS = {
  nameMax: 80,
  versionMax: 40,
  notesMax: 500,
} as const;

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
export function validateUploadPayload(body: Partial<UploadPayload> | null): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Missing request body." };
  }

  const name = String(body.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > UPLOAD_LIMITS.nameMax) {
    return { ok: false, error: `Name must be ${UPLOAD_LIMITS.nameMax} characters or fewer.` };
  }
  if (!NAME_RE.test(name)) {
    return { ok: false, error: "Name contains unsupported characters." };
  }

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
