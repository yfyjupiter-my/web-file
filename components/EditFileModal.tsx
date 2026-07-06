"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "@/lib/validation";
import { formatBytes } from "@/lib/stats";
import type {
  InstallerFile,
  ReplaceUrlResponse,
  UpdateResponse,
} from "@/lib/types";

interface Props {
  file: InstallerFile;
  categories: string[];
  onClose: () => void;
  onConflict: (name: string) => void;
  onSaved: () => void;
}

const ACCEPT = [".exe", ".msi", ".dmg", ".zip", ".pkg"];

// The stored `version` string is "<version> · <date>" (see UploadModal); split
// it back out so each field can be edited independently.
function splitVersion(combined: string): [string, string] {
  const idx = combined.indexOf(" · ");
  if (idx === -1) return [combined === "—" ? "" : combined, ""];
  return [combined.slice(0, idx), combined.slice(idx + 3)];
}

export function EditFileModal({ file, categories, onClose, onConflict, onSaved }: Props) {
  const [name, setName] = useState(file.name);
  const [category, setCategory] = useState(file.category);
  const [initialVersion, initialDate] = splitVersion(file.version);
  const [version, setVersion] = useState(initialVersion);
  const [releaseDate, setReleaseDate] = useState(initialDate);
  const [notes, setNotes] = useState(file.notes ?? "");
  const [replacement, setReplacement] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Client-side pre-check (the server re-validates authoritatively).
  function onFilePicked(f: File | null) {
    setError(null);
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPT.includes(ext)) {
      setError(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS}.`);
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError(`File exceeds the ${MAX_UPLOAD_MB}MB limit.`);
      return;
    }
    setReplacement(f);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let storageKey: string | undefined;
      let sizeBytes: number | undefined;

      if (replacement) {
        // 1. Reserve a new object path under this file's existing id.
        const urlRes = await fetch(`/api/files/${file.id}/replace-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: replacement.name }),
        });
        const urlData: ReplaceUrlResponse = await urlRes
          .json()
          .catch(() => ({ ok: false }));
        if (!urlRes.ok || !urlData.ok || !urlData.uploadUrl || !urlData.storageKey) {
          setError(urlData.error ?? "Couldn't start the upload. Please try again.");
          return;
        }

        // 2. Upload the new bytes straight to Storage.
        const put = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": replacement.type || "application/octet-stream" },
          body: replacement,
        });
        if (!put.ok) {
          setError("Upload failed while sending the file. Please try again.");
          return;
        }

        storageKey = urlData.storageKey;
        sizeBytes = replacement.size;
      }

      // 3. Commit the metadata (and, if attached, the new binary pointer).
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          version: [version.trim(), releaseDate.trim()].filter(Boolean).join(" · "),
          notes,
          ...(storageKey ? { storageKey, sizeBytes } : {}),
        }),
      });
      if (res.status === 409) {
        onConflict(name);
        return;
      }
      if (res.ok) {
        onSaved();
        return;
      }
      const data: UpdateResponse = await res.json().catch(() => ({ ok: false }));
      setError(data.error ?? "Couldn't save changes. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit installer">
      <div className="modal">
        <div className="modal-header">
          Edit Installer
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div
            className={`modal-dropzone ${dragOver ? "drag-over" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Choose a replacement file"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFilePicked(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <div className="up">↑</div>
            {replacement ? (
              <small>
                {replacement.name} · {formatBytes(replacement.size)}
              </small>
            ) : (
              <small>Drag a new {file.type} here to replace it, or click to browse</small>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              hidden
              onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="form-grid">
            <div className="modal-field">
              <label>Display Name</label>
              <input
                className="modal-input"
                placeholder="e.g. Setup Wizard 2.4"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label>Category</label>
              <select className="modal-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>Version</label>
              <input
                className="modal-input"
                placeholder="v2.4"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label>Date</label>
              <input
                className="modal-input"
                placeholder="Jun 28, 2026"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>
            <div className="modal-field full">
              <label>Notes</label>
              <textarea
                className="modal-input"
                placeholder="Optional release notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
        {error && <div className="error-text modal-error">{error}</div>}
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving || !name || !category}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
