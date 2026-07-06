import type { InstallerFile } from "@/lib/types";

interface Props {
  files: InstallerFile[];
}

export function FileTable({ files }: Props) {
  return (
    <table className="file-table file-table--compact file-table--bordered">
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Version</th>
          <th>Date</th>
          <th>Size</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr key={file.id}>
            <td>
              <div className="file-name-cell">
                <span className="file-type-icon">{file.type}</span>
                <span className="file-name">{file.name}</span>
              </div>
            </td>
            <td>
              <span className="tag-pill">{file.category}</span>
            </td>
            <td>{file.version}</td>
            <td>{file.uploadedAt}</td>
            <td>{file.sizeLabel}</td>
            <td>
              <a
                className="row-download"
                href={`/api/files/${file.id}/download`}
                aria-label={`Download ${file.name}`}
              >
                Download
              </a>
            </td>
          </tr>
        ))}
        {files.length === 0 && (
          <tr>
            <td colSpan={6} className="file-table-empty">
              No installers match this filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
