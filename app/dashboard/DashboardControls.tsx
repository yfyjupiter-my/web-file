"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Tab } from "@/lib/categories";
import type { InstallerFile } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { FileTable } from "@/components/FileTable";
import { ConflictToast } from "@/components/ConflictToast";

// P4.5 — the upload modal chunk is only needed once the user opens it, so
// load it lazily. `ssr: false` keeps it out of the server-rendered HTML (it's
// a purely interactive, initially-hidden overlay).
const UploadModal = dynamic(
  () => import("@/components/UploadModal").then((m) => m.UploadModal),
  { ssr: false }
);

/**
 * Client island for the dashboard: owns only the interactive state (tab,
 * search, modal, conflict). Initial file data is fetched server-side and
 * passed in, so the file list and filtering logic don't bloat the bundle
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
  const [modalOpen, setModalOpen] = useState(false);
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

  return (
    <>
      <div className="app-body">
        <Sidebar files={initialFiles} activeTab={activeTab} onSelect={setActiveTab} />
        <div className="main">
          <div className="toolbar-2">
            <label className="search-inline">
              🔍{" "}
              <input
                placeholder="Search installers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button className="btn btn-upload" onClick={() => setModalOpen(true)}>
              ＋ Upload Installer
            </button>
          </div>

          <FileTable files={files} />
        </div>
      </div>

      {modalOpen && (
        <UploadModal
          onClose={() => setModalOpen(false)}
          onConflict={(name) => setConflictName(name)}
          onSaved={() => {
            setModalOpen(false);
            // Pull the just-persisted file from the server so it appears in the table.
            router.refresh();
          }}
        />
      )}

      {conflictName && (
        <ConflictToast
          fileName={conflictName}
          onKeepBoth={() => setConflictName(null)}
          onReplace={() => {
            setConflictName(null);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
