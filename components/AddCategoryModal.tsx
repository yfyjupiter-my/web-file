"use client";

import { useState } from "react";
import type { CreateCategoryResponse } from "@/lib/types";
import { useModalA11y } from "./useModalA11y";

interface Props {
  onClose: () => void;
  onSaved: (category: string) => void;
}

export function AddCategoryModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useModalA11y(onClose);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data: CreateCategoryResponse = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok || !data.category) {
        setError(data.error ?? "Couldn't add the category. Please try again.");
        return;
      }
      onSaved(data.category);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add category"
    >
      <div className="modal">
        <div className="modal-header">
          Add Category
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="modal-field full">
              <label>Category Name</label>
              <input
                className="modal-input"
                placeholder="e.g. Developer Tools"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !saving) handleSave();
                }}
              />
            </div>
          </div>
        </div>
        {error && (
          <div className="error-text modal-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Adding…" : "Add Category"}
          </button>
        </div>
      </div>
    </div>
  );
}
