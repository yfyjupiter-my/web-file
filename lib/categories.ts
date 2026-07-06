import type { Category } from "./types";

/**
 * Permanent domain taxonomy. Unlike lib/mock-data.ts (deletable fixtures),
 * this is real product data — the category vocabulary the app is built around.
 */
export const categories: Category[] = [
  "OS / Drivers",
  "Productivity",
  "Security / AV",
  "Utilities",
  "Uncategorized",
];

/** Runtime guard for validating untrusted `category` values (e.g. upload input). */
export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (categories as string[]).includes(value);
}

/** Dashboard tab type: "All" plus every category, derived from the taxonomy. */
export type Tab = "All" | Category;
