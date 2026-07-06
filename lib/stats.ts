import type { InstallerFile } from "./types";

const UNIT_TO_MB: Record<string, number> = {
  KB: 1 / 1024,
  MB: 1,
  GB: 1024,
  TB: 1024 * 1024,
};

/**
 * Parse a human size label (e.g. "84 MB", "1.2 GB") into megabytes.
 * Returns 0 for placeholders ("—") or anything unparseable — the mock repo
 * assigns "—" to freshly uploaded files whose real size isn't known yet.
 */
export function parseSizeLabelMB(label: string): number {
  const m = /^([\d.]+)\s*(KB|MB|GB|TB)$/i.exec(label.trim());
  if (!m) return 0;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return 0;
  return value * (UNIT_TO_MB[m[2].toUpperCase()] ?? 0);
}

/** Format a megabyte total back into the largest sensible unit. */
export function formatStorageMB(totalMB: number): string {
  if (totalMB >= 1024 * 1024) return `${(totalMB / (1024 * 1024)).toFixed(1)} TB`;
  if (totalMB >= 1024) return `${(totalMB / 1024).toFixed(1)} GB`;
  return `${Math.round(totalMB)} MB`;
}

/** Derived dashboard stats — computed from the data, never hardcoded (CODE-60/61). */
export interface FileStats {
  total: number;
  storage: string;
  formats: number;
}

export function computeFileStats(files: InstallerFile[]): FileStats {
  const totalMB = files.reduce((sum, f) => sum + parseSizeLabelMB(f.sizeLabel), 0);
  const formats = new Set(files.map((f) => f.type)).size;
  return {
    total: files.length,
    storage: formatStorageMB(totalMB),
    formats,
  };
}
