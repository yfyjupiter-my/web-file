import type { InstallerFile } from "@/lib/types";
import { categories } from "@/lib/categories";
import { computeFileStats } from "@/lib/stats";

interface Props {
  files: InstallerFile[];
}

export function StatStrip({ files }: Props) {
  const stats = computeFileStats(files);

  return (
    <div className="stat-strip">
      <div className="stat-cell">
        <div className="stat-num">{stats.total}</div>
        <div className="stat-label">Total installers</div>
      </div>
      <div className="stat-cell">
        <div className="stat-num">{stats.storage}</div>
        <div className="stat-label">Storage used</div>
      </div>
      <div className="stat-cell">
        <div className="stat-num">{stats.formats}</div>
        <div className="stat-label">File formats</div>
      </div>
      <div className="stat-cell">
        <div className="stat-num">{categories.length}</div>
        <div className="stat-label">Categories</div>
      </div>
    </div>
  );
}
