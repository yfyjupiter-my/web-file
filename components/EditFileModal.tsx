"use client";

import { useState } from "react";
import type { InstallerFile, UpdateResponse } from "@/lib/types";

interface Props {
  file: InstallerFile;
  categories: string[];
  onClose: () => void;
  onConflict: (name: string) => void;
  onSaved: () => void;
}

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          version: [version.trim(), releaseDate.trim()].filter(Boolean).join(" · "),
          notes,
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
