import type { InstallerFile } from "./types";

/**
 * TEMPORARY FIXTURES — safe to delete once Supabase is wired up.
 *
 * These seed the mock repository (lib/files-repo.ts). The permanent category
 * taxonomy lives in lib/categories.ts and is NOT part of this file.
 */
export const mockFiles: InstallerFile[] = [
  { id: "1", name: "Setup Wizard", type: "EXE", category: "Utilities", version: "v2.4", sizeLabel: "84 MB", uploadedAt: "2026-06-28" },
  { id: "2", name: "Driver Pack", type: "MSI", category: "OS / Drivers", version: "v1.9", sizeLabel: "210 MB", uploadedAt: "2026-06-22" },
  { id: "3", name: "Mac Client", type: "DMG", category: "Productivity", version: "v3.1", sizeLabel: "66 MB", uploadedAt: "2026-06-19" },
  { id: "4", name: "Portable Tools", type: "ZIP", category: "Utilities", version: "v4.0", sizeLabel: "41 MB", uploadedAt: "2026-06-15" },
  { id: "5", name: "Agent Bundle", type: "PKG", category: "Utilities", version: "v2.0", sizeLabel: "128 MB", uploadedAt: "2026-06-11" },
  { id: "6", name: "AV Scanner", type: "EXE", category: "Security / AV", version: "v6.2", sizeLabel: "92 MB", uploadedAt: "2026-06-08" },
  { id: "7", name: "VPN Client", type: "MSI", category: "Security / AV", version: "v1.3", sizeLabel: "38 MB", uploadedAt: "2026-06-04" },
  { id: "8", name: "Font Pack", type: "ZIP", category: "Productivity", version: "v5.5", sizeLabel: "19 MB", uploadedAt: "2026-06-01" },
];
