"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "@/lib/validation";
import { formatBytes } from "@/lib/stats";
import type {
  UploadCommitPayload,
  UploadResponse,
  UploadUrlResponse,
} from "@/lib/types";

interface Props {
  categories: string[];
  onClose: () => void;
  onConflict: (name: string) => void;
  onSaved: () => void;
}

const ACCEPT = [".exe", ".msi", ".dmg", ".zip", ".pkg"];

export function UploadModal({ categories, onClose, onConflict, onSaved }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
    setFile(f);
    // Autofill the display name from the filename if the user hasn't typed one.
    if (!name.trim()) {
      const dot = f.name.lastIndexOf(".");
      setName(dot > 0 ? f.name.slice(0, dot) : f.name);
    }
  }

  async function handleSave() {
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      // 1. Reserve an id + object path and get a signed upload URL.
      const urlRes = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filename: file.name }),
      });
      if (urlRes.status === 409) {
        onConflict(name);
        return;
      }
      const urlData: UploadUrlResponse = await urlRes
        .json()
        .catch(() => ({ ok: false }));
      if (!urlRes.ok || !urlData.ok || !urlData.uploadUrl || !urlData.id || !urlData.storageKey) {
        setError(urlData.error ?? "Couldn't start the upload. Please try again.");
        return;
      }

      // 2. Upload the bytes straight to Storage (bypasses the API body limit).
      const put = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setError("Upload failed while sending the file. Please try again.");
        return;
      }

      // 3. Commit the metadata row now that the binary is stored.
      const payload: UploadCommitPayload = {
        name,
        category,
        version,
        notes,
        id: urlData.id,
        storageKey: urlData.storageKey,
        sizeBytes: file.size,
      };
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        onConflict(name);
        return;
      }
      if (res.ok) {
        onSaved();
        return;
      }
      const data: UploadResponse = await res.json().catch(() => ({ ok: false }));
      setError(data.error ?? "Upload failed. Please try again.");
    } catch {
      // Network failure / request aborted — surface it instead of hanging.
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Upload installer">
      <div className="modal">
        <div className="modal-header">
          Upload Installer
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div
            className={`modal-dropzone ${dragOver ? "drag-over" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Choose a file to upload"
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
            {file ? (
              <small>
                {file.name} · {formatBytes(file.size)}
              </small>
            ) : (
              <small>Drag file here or click to browse</small>
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
              <label>Version / Date</label>
              <input
                className="modal-input"
                placeholder="v2.4 · Jun 28, 2026"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
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
          <button className="btn" onClick={handleSave} disabled={saving || !name || !file || !category}>
            {saving ? "Uploading…" : "Save File"}
          </button>
        </div>
      </div>
    </div>
  );
}
