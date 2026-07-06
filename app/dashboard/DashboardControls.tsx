"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { categories, type Tab } from "@/lib/categories";
import type { InstallerFile } from "@/lib/types";
import { FileCard } from "@/components/FileCard";
import { ConflictToast } from "@/components/ConflictToast";

// P4.5 — the drawer chunk is only needed once the user opens it, so load it
// lazily. `ssr: false` keeps it out of the server-rendered HTML (it's a purely
// interactive, initially-hidden panel).
const UploadDrawer = dynamic(
  () => import("@/components/UploadDrawer").then((m) => m.UploadDrawer),
  { ssr: false }
);

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conflictName, setConflictName] = useState<string | null>(null);

  // P4.3 (frontend half) — debounce the search input so filtering doesn't run
  // on every keystroke. When search moves server-side (Supabase `ilike`), this
  // same debounced value becomes the fetch trigger.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const files = useMemo(() => {
    const needle = debouncedQuery.toLowerCase();
    return initialFiles.filter((f) => {
      const matchesTab = activeTab === "All" || f.category === activeTab;
      const matchesQuery = f.name.toLowerCase().includes(needle);
      return matchesTab && matchesQuery;
    });
  }, [initialFiles, activeTab, debouncedQuery]);

  // P4.4 — one `card-grid` instance, always at the same position in the tree.
  // The drawer-open state only toggles a wrapper/dim class, so opening the
  // drawer no longer unmounts and remounts every FileCard (which memoization
  // in FileCard then keeps cheap on unrelated re-renders).
  const grid = (
    <div className={`card-grid ${view === "list" ? "list-view" : ""}`}>
      {files.map((f) => (
        <FileCard key={f.id} file={f} />
      ))}
    </div>
  );

  return (
    <>
      <div className="tabs-row" role="tablist" aria-label="Filter by category">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "All"}
          className={`tab ${activeTab === "All" ? "active" : ""}`}
          onClick={() => setActiveTab("All")}
        >
          All ({initialFiles.length})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={activeTab === c}
            className={`tab ${activeTab === c ? "active" : ""}`}
            onClick={() => setActiveTab(c)}
          >
            {c}
          </button>
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
        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            ▦
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            ☰
          </button>
        </div>
        <button className="btn btn-upload" onClick={() => setDrawerOpen(true)}>
          ＋ Upload Installer
        </button>
      </div>

      <div className={drawerOpen ? "with-drawer" : undefined}>
        <div className={drawerOpen ? "dashboard-dim" : undefined}>{grid}</div>
        {drawerOpen && (
          <UploadDrawer
            onClose={() => setDrawerOpen(false)}
            onConflict={(name) => setConflictName(name)}
            onSaved={() => {
              setDrawerOpen(false);
              // Pull the just-persisted file from the server so it appears in the grid.
              router.refresh();
            }}
          />
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
    </>
  );
}
