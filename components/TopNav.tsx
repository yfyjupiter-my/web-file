"use client";

import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TopNav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  return (
    <div className="app-topnav">
      <div className="logo">
        <span className="mark" />
        Installer Vault
      </div>
      <div className="topnav-right">
        <ThemeToggle />
        <button type="button" className="pill pill-btn" onClick={handleLogout}>
          Log Out
        </button>
        <div className="avatar" />
      </div>
    </div>
  );
}
