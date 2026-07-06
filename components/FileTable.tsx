import { useEffect, useRef } from "react";
import type { InstallerFile } from "@/lib/types";

interface Props {
  files: InstallerFile[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

export function FileTable({ files, selectedIds, onToggle, onToggleAll }: Props) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const selectedVisible = files.filter((f) => selectedIds.has(f.id)).length;
  const allSelected = files.length > 0 && selectedVisible === files.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selectedVisible > 0 && !allSelected;
    }
  }, [selectedVisible, allSelected]);

  return (
    <table className="file-table file-table--compact file-table--bordered">
      <thead>
        <tr>
          <th className="file-table-checkbox-col">
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              aria-label="Select all installers"
              disabled={files.length === 0}
            />
          </th>
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
          <tr key={file.id} className={selectedIds.has(file.id) ? "selected" : undefined}>
            <td className="file-table-checkbox-col">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => onToggle(file.id)}
                aria-label={`Select ${file.name}`}
              />
            </td>
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
            <td colSpan={7} className="file-table-empty">
              No installers match this filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
