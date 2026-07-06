import type { Category } from "./types";

/**
 * The category taxonomy is a persisted, user-extensible list (see
 * lib/categories-repo.ts) rather than a hardcoded array — this module only
 * holds the shared `Tab` type and the validation guard.
 */

/** Runtime guard for validating an untrusted `category` value against the current list. */
export function isCategory(value: unknown, validCategories: string[]): value is Category {
  return typeof value === "string" && validCategories.includes(value);
}

/** Dashboard tab type: "All" plus every category. */
export type Tab = "All" | Category;
