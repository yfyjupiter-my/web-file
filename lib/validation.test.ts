import { describe, it, expect } from "vitest";
import { validateUploadPayload, validateFilename, UPLOAD_LIMITS } from "./validation";

describe("validateUploadPayload", () => {
  const valid = { name: "Setup Wizard", category: "Utilities", version: "v2.4" };

  it("accepts and normalizes a valid payload", () => {
    const r = validateUploadPayload({ ...valid, name: "  Setup Wizard  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Setup Wizard");
      expect(r.value.category).toBe("Utilities");
    }
  });

  it("rejects a null/empty body", () => {
    expect(validateUploadPayload(null).ok).toBe(false);
    expect(validateUploadPayload({}).ok).toBe(false);
  });

  it("rejects an empty or whitespace name", () => {
    expect(validateUploadPayload({ ...valid, name: "   " }).ok).toBe(false);
  });

  it("rejects a name over the length cap", () => {
    const r = validateUploadPayload({ ...valid, name: "a".repeat(UPLOAD_LIMITS.nameMax + 1) });
    expect(r.ok).toBe(false);
  });

  it("rejects path-separator / control chars in name (traversal defense)", () => {
    expect(validateUploadPayload({ ...valid, name: "../etc/passwd" }).ok).toBe(false);
    expect(validateUploadPayload({ ...valid, name: "a\\b" }).ok).toBe(false);
    expect(validateUploadPayload({ ...valid, name: "a\n b" }).ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(validateUploadPayload({ ...valid, category: "Malware" }).ok).toBe(false);
    expect(validateUploadPayload({ ...valid, category: "" }).ok).toBe(false);
  });

  it("caps notes length", () => {
    const r = validateUploadPayload({ ...valid, notes: "x".repeat(UPLOAD_LIMITS.notesMax + 1) });
    expect(r.ok).toBe(false);
  });

  it("treats empty notes/version as absent-ish", () => {
    const r = validateUploadPayload({ ...valid, version: "", notes: "  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.version).toBe("");
      expect(r.value.notes).toBeUndefined();
    }
  });
});

describe("validateFilename", () => {
  it("maps a known extension to its FileType (case-insensitive)", () => {
    const r = validateFilename("Setup.EXE");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe("EXE");
      expect(r.safeName.endsWith(".exe")).toBe(true);
    }
  });

  it("rejects an unsupported extension", () => {
    expect(validateFilename("payload.sh").ok).toBe(false);
    expect(validateFilename("noextension").ok).toBe(false);
    expect(validateFilename("").ok).toBe(false);
  });

  it("sanitizes the basename but keeps the extension (traversal defense)", () => {
    const r = validateFilename("../../evil name!.msi");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.safeName).not.toMatch(/[/\\]/);
      expect(r.safeName.endsWith(".msi")).toBe(true);
      expect(r.type).toBe("MSI");
    }
  });
});
