"use client";

import { useMemo, useState } from "react";
import { mockFiles, categories } from "@/lib/mock-data";
import { TopNav } from "@/components/TopNav";
import { StatStrip } from "@/components/StatStrip";
import { FileCard } from "@/components/FileCard";
import { UploadDrawer } from "@/components/UploadDrawer";
import { ConflictToast } from "@/components/ConflictToast";

type Tab = "All" | (typeof categories)[number];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conflictName, setConflictName] = useState<string | null>(null);

  const files = useMemo(() => {
    return mockFiles.filter((f) => {
      const matchesTab = activeTab === "All" || f.category === activeTab;
      const matchesQuery = f.name.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [activeTab, query]);

  return (
    <main className="page-wrap">
      <div className="screen">
        <TopNav adminOn={drawerOpen} />
        <StatStrip files={mockFiles} />

        <div className="tabs-row">
          <div className={`tab ${activeTab === "All" ? "active" : ""}`} onClick={() => setActiveTab("All")}>
            All ({mockFiles.length})
          </div>
          {categories.map((c) => (
            <div key={c} className={`tab ${activeTab === c ? "active" : ""}`} onClick={() => setActiveTab(c)}>
              {c}
            </div>
          ))}
        </div>

        <div className="toolbar-2">
          <label className="search-inline">
            🔍 <input placeholder="Search installers…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
            <div className="dashboard-dim">
              <div className={`card-grid ${view === "list" ? "list-view" : ""}`}>
                {files.map((f) => (
                  <FileCard key={f.id} file={f} />
                ))}
              </div>
            </div>
            <UploadDrawer
              onClose={() => setDrawerOpen(false)}
              onConflict={(name) => setConflictName(name)}
              onSaved={() => setDrawerOpen(false)}
            />
          </div>
        ) : (
          <div className={`card-grid ${view === "list" ? "list-view" : ""}`}>
            {files.map((f) => (
              <FileCard key={f.id} file={f} />
            ))}
          </div>
        )}
      </div>

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
    </main>
  );
}
