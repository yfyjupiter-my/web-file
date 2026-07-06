"use client";

import { useState } from "react";
import { categories } from "@/lib/categories";
import type { UploadPayload } from "@/lib/types";

interface Props {
  onClose: () => void;
  onConflict: (name: string) => void;
  onSaved: () => void;
}

export function UploadDrawer({ onClose, onConflict, onSaved }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const payload: UploadPayload = { name, category, version, notes };
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (res.status === 409) {
      onConflict(name);
      return;
    }
    if (res.ok) {
      onSaved();
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-header">
        Upload Installer
        <button className="x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="drawer-body">
        <div className="drawer-dropzone">
          <div className="up">↑</div>
          <small>Drag file here or click to browse</small>
        </div>
        <div className="drawer-field">
          <label>Display Name</label>
          <input
            className="drawer-input"
            placeholder="e.g. Setup Wizard 2.4"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="drawer-field">
          <label>Category</label>
          <select className="drawer-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="drawer-field">
          <label>Version / Date</label>
          <input
            className="drawer-input"
            placeholder="v2.4 · Jun 28, 2026"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
        <div className="drawer-field">
          <label>Notes</label>
          <textarea
            className="drawer-input"
            placeholder="Optional release notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <div className="drawer-footer">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" onClick={handleSave} disabled={saving || !name}>
          {saving ? "Saving…" : "Save File"}
        </button>
      </div>
    </div>
  );
}
