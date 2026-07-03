export type FileType = "EXE" | "MSI" | "DMG" | "ZIP" | "PKG";

export type Category =
  | "OS / Drivers"
  | "Productivity"
  | "Security / AV"
  | "Utilities"
  | "Uncategorized";

export interface InstallerFile {
  id: string;
  name: string;
  type: FileType;
  category: Category;
  version: string;
  sizeLabel: string;
  uploadedAt: string;
  notes?: string;
}
