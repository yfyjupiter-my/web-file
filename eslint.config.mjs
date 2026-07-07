// Flat ESLint config (eslint 9+/Next 16 — `next lint` was removed, the lint
// script now runs the ESLint CLI directly). Mirrors the old .eslintrc.json.
import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["node_modules/", ".next/", "**/*.html", "next-env.d.ts"],
  },
];

export default config;
