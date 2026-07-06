"use client";

import { useState } from "react";
import type { ChangePasswordResponse } from "@/lib/types";

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSave() {
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data: ChangePasswordResponse = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setDone(true);
        return;
      }
      setError(data.error ?? "Couldn't change the password. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Change password">
      <div className="modal">
        <div className="modal-header">
          Change Password
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {done ? (
            <p>Your password has been changed.</p>
          ) : (
            <div className="form-grid">
              <div className="modal-field full">
                <label>Current Password</label>
                <input
                  type="password"
                  className="modal-input"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="modal-field full">
                <label>New Password</label>
                <input
                  type="password"
                  className="modal-input"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="modal-field full">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="modal-input"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        {error && <div className="error-text modal-error">{error}</div>}
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button
              className="btn"
              onClick={handleSave}
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
