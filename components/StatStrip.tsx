import type { InstallerFile } from "@/lib/types";
import { categories } from "@/lib/mock-data";

export function StatStrip({ files }: { files: InstallerFile[] }) {
  return (
    <div className="stat-strip">
      <div className="stat-cell">
        <div className="stat-num">
          {files.length} <span className="up">▲ 3</span>
        </div>
        <div className="stat-label">Total installers</div>
      </div>
      <div className="stat-cell">
        <div className="stat-num">
          1.2<span style={{ fontSize: 16 }}>TB</span>
        </div>
        <div className="stat-label">Storage used</div>
      </div>
      <div className="stat-cell">
        <div className="stat-num">318</div>
        <div className="stat-label">Downloads this week</div>
      </div>
      <div className="stat-cell">
        <div className="stat-num">{categories.length}</div>
        <div className="stat-label">Categories</div>
      </div>
    </div>
  );
}
