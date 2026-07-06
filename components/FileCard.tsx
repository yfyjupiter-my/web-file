import { memo } from "react";
import type { InstallerFile } from "@/lib/types";

// P4.6 — memoized so that re-renders driven by unrelated dashboard state
// (drawer open/close, view toggle, search) skip cards whose `file` prop is
// referentially unchanged. The file objects come straight from the
// server-fetched `initialFiles`, so their identity is stable across renders.
function FileCardBase({ file }: { file: InstallerFile }) {
  return (
    <div className="file-card">
      <div className="card-thumb">
        <span className="type">{file.type}</span>
        <span className="card-badge">{file.version}</span>
      </div>
      <div className="card-body">
        <div className="card-title">{file.name}</div>
        <div className="card-meta">
          <span>{file.sizeLabel}</span>
          <span>{file.uploadedAt}</span>
        </div>
      </div>
      <div className="card-footer">
        <div className="dl">Download</div>
        <div>⋯</div>
      </div>
    </div>
  );
}

export const FileCard = memo(FileCardBase);
