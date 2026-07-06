"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Tab } from "@/lib/categories";
import type { InstallerFile } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { FileTable } from "@/components/FileTable";
import { ConflictToast } from "@/components/ConflictToast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

// P4.5 — the upload modal chunk is only needed once the user opens it, so
// load it lazily. `ssr: false` keeps it out of the server-rendered HTML (it's
// a purely interactive, initially-hidden overlay).
const UploadModal = dynamic(
  () => import("@/components/UploadModal").then((m) => m.UploadModal),
  { ssr: false }
);

const AddCategoryModal = dynamic(
  () => import("@/components/AddCategoryModal").then((m) => m.AddCategoryModal),
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
  initialCategories,
}: {
  initialFiles: InstallerFile[];
  initialCategories: string[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<InstallerFile[] | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // A changed filter can hide previously-selected rows; drop the selection
  // rather than let "3 selected" silently refer to now-invisible files.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, debouncedQuery]);

  const selectedFiles = useMemo(
    () => initialFiles.filter((f) => selectedIds.has(f.id)),
    [initialFiles, selectedIds]
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = files.length > 0 && files.every((f) => prev.has(f.id));
      return allSelected ? new Set() : new Set(files.map((f) => f.id));
    });
  }

  function handleBulkDownload() {
    // Stagger the clicks slightly — firing several downloads in the same tick
    // gets some browsers to collapse them into one.
    selectedFiles.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `/api/files/${f.id}/download`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 150);
    });
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      await Promise.all(
        selectedFiles.map((f) => fetch(`/api/files/${f.id}`, { method: "DELETE" }))
      );
      setSelectedIds(new Set());
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="app-body">
        <Sidebar
          files={initialFiles}
          categories={categories}
          activeTab={activeTab}
          onSelect={setActiveTab}
          onAddCategory={() => setAddCategoryOpen(true)}
        />
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

          {selectedIds.size > 0 && (
            <div className="bulk-bar">
              <div>{selectedIds.size} selected</div>
              <div className="bulk-bar-actions">
                <button className="btn ghost" onClick={handleBulkDownload}>
                  Download
                </button>
                <button className="btn ghost" onClick={() => setDeleteTarget(selectedFiles)}>
                  Delete
                </button>
                <button className="btn ghost" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </button>
              </div>
            </div>
          )}

          <FileTable
            files={files}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
          />
        </div>
      </div>

      {modalOpen && (
        <UploadModal
          categories={categories}
          onClose={() => setModalOpen(false)}
          onConflict={(name) => setConflictName(name)}
          onSaved={() => {
            setModalOpen(false);
            // Pull the just-persisted file from the server so it appears in the table.
            router.refresh();
          }}
        />
      )}

      {addCategoryOpen && (
        <AddCategoryModal
          onClose={() => setAddCategoryOpen(false)}
          onSaved={(category) => {
            setCategories((prev) => [...prev, category]);
            setAddCategoryOpen(false);
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

      {deleteTarget && (
        <DeleteConfirmModal
          files={deleteTarget}
          pending={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleBulkDelete}
        />
      )}
    </>
  );
}
