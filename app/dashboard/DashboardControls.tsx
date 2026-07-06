"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { categories, type Tab } from "@/lib/categories";
import type { InstallerFile } from "@/lib/types";
import { FileCard } from "@/components/FileCard";
import { UploadDrawer } from "@/components/UploadDrawer";
import { ConflictToast } from "@/components/ConflictToast";

/**
 * Client island for the dashboard: owns only the interactive state (tab,
 * search, view, drawer, conflict). Initial file data is fetched server-side
 * and passed in, so the file list and filtering logic don't bloat the bundle
 * beyond what interactivity requires.
 */
export function DashboardControls({
  initialFiles,
}: {
  initialFiles: InstallerFile[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conflictName, setConflictName] = useState<string | null>(null);

  const files = useMemo(() => {
    return initialFiles.filter((f) => {
      const matchesTab = activeTab === "All" || f.category === activeTab;
      const matchesQuery = f.name.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [initialFiles, activeTab, query]);

  const grid = (
    <div className={`card-grid ${view === "list" ? "list-view" : ""}`}>
      {files.map((f) => (
        <FileCard key={f.id} file={f} />
      ))}
    </div>
  );

  return (
    <>
      <div className="tabs-row">
        <div
          className={`tab ${activeTab === "All" ? "active" : ""}`}
          onClick={() => setActiveTab("All")}
        >
          All ({initialFiles.length})
        </div>
        {categories.map((c) => (
          <div
            key={c}
            className={`tab ${activeTab === c ? "active" : ""}`}
            onClick={() => setActiveTab(c)}
          >
            {c}
          </div>
        ))}
      </div>

      <div className="toolbar-2">
        <label className="search-inline">
          🔍{" "}
          <input
            placeholder="Search installers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="view-toggle">
          <div className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
            ▦
          </div>
          <div className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            ☰
          </div>
        </div>
        <button className="btn btn-upload" onClick={() => setDrawerOpen(true)}>
          ＋ Upload Installer
        </button>
      </div>

      {drawerOpen ? (
        <div className="with-drawer">
          <div className="dashboard-dim">{grid}</div>
          <UploadDrawer
            onClose={() => setDrawerOpen(false)}
            onConflict={(name) => setConflictName(name)}
            onSaved={() => {
              setDrawerOpen(false);
              // Pull the just-persisted file from the server so it appears in the grid.
              router.refresh();
            }}
          />
        </div>
      ) : (
        grid
      )}

      {conflictName && (
        <ConflictToast
          fileName={conflictName}
          onKeepBoth={() => setConflictName(null)}
          onReplace={() => {
            setConflictName(null);
            setDrawerOpen(false);
          }}
        />
      )}
    </>
  );
}
