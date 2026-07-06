"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthResponse } from "@/lib/types";

export default function PasswordGatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/dashboard");
        return;
      }

      const data: AuthResponse = await res
        .json()
        .catch(() => ({ ok: false, error: "Something went wrong." }));
      setError(data.error ?? "Incorrect password.");
    } catch {
      // Network failure / request aborted — surface it instead of hanging.
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-wrap page-wrap--full">
      <div className="screen screen--full">
        <div className="split split--full">
          <div className="split-visual">
            <div className="split-visual-inner">
              <div className="glyph">🔐</div>
              <b>SECURE VAULT</b>
              <span>Encrypted installer distribution for your team</span>
            </div>
          </div>
          <form className="split-form" onSubmit={handleSubmit}>
            <span className="pill kicker">● Secure Access</span>
            <h1>Installer Vault</h1>
            <div className="sub">
              Enter the shared password to browse and download the latest verified installers.
            </div>
            <label className="field">
              🔑{" "}
              <input
                type="password"
                placeholder="Enter shared password…"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </label>
            {error && <div className="error-text">{error}</div>}
            <button className="btn" type="submit" disabled={submitting || !password}>
              {submitting ? "Checking…" : "Unlock Vault →"}
            </button>
            <div className="helper">Session stays unlocked for this browser until you log out.</div>
          </form>
        </div>
      </div>
    </main>
  );
}
