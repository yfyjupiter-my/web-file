import { categories, type Tab } from "@/lib/categories";
import type { InstallerFile } from "@/lib/types";

interface Props {
  files: InstallerFile[];
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}

export function Sidebar({ files, activeTab, onSelect }: Props) {
  return (
    <nav className="sidebar" aria-label="Filter by category">
      <div className="sidebar-title">Categories</div>
      <button
        type="button"
        className={`sidebar-item ${activeTab === "All" ? "active" : ""}`}
        aria-current={activeTab === "All"}
        onClick={() => onSelect("All")}
      >
        All Installers ({files.length})
      </button>
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          className={`sidebar-item ${activeTab === c ? "active" : ""}`}
          aria-current={activeTab === c}
          onClick={() => onSelect(c)}
        >
          {c} ({files.filter((f) => f.category === c).length})
        </button>
      ))}
    </nav>
  );
}
