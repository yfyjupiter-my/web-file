import type { InstallerFile } from "@/lib/types";

export function FileCard({ file }: { file: InstallerFile }) {
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
