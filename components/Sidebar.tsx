import type { Tab } from "@/lib/categories";
import type { InstallerFile } from "@/lib/types";

interface Props {
  files: InstallerFile[];
  categories: string[];
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
  onAddCategory: () => void;
}

export function Sidebar({ files, categories, activeTab, onSelect, onAddCategory }: Props) {
  return (
    <nav className="sidebar" aria-label="Filter by category">
      <div className="sidebar-title-row">
        <div className="sidebar-title">Categories</div>
        <button
          type="button"
          className="sidebar-add"
          onClick={onAddCategory}
          aria-label="Add category"
        >
          ＋
        </button>
      </div>
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
