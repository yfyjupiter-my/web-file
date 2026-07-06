/**
 * Active visual theme, applied as `data-theme` on <html> and consumed by the
 * CSS custom-property blocks in globals.css. A named constant (rather than a
 * bare string literal) keeps the value typed and greppable (CODE-25).
 */
export const THEMES = ["sunset"] as const;
export type Theme = (typeof THEMES)[number];

export const ACTIVE_THEME: Theme = "sunset";
