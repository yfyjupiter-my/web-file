import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js resolves `server-only` via a bundler alias; Vitest has no such
      // boundary, so point it at an empty stub.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
