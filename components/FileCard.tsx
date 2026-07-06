import { memo } from "react";
import type { InstallerFile } from "@/lib/types";

interface Props {
  file: InstallerFile;
}

// P4.6 — memoized so that re-renders driven by unrelated dashboard state
// (drawer open/close, view toggle, search) skip cards whose `file` prop is
// referentially unchanged. The file objects come straight from the
// server-fetched `initialFiles`, so their identity is stable across renders.
function FileCardBase({ file }: Props) {
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
        {file.notes && <div className="card-notes">{file.notes}</div>}
      </div>
      <div className="card-footer">
        {/* Auth-gated route 302s to a short-lived Supabase signed URL, so the
            browser downloads the binary straight from Storage. */}
        <a
          className="dl"
          href={`/api/files/${file.id}/download`}
          aria-label={`Download ${file.name}`}
        >
          Download
        </a>
        <button type="button" aria-label={`More actions for ${file.name}`}>
          ⋯
        </button>
      </div>
    </div>
  );
}

export const FileCard = memo(FileCardBase);
