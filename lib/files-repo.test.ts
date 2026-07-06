import { describe, it, expect, vi, beforeEach } from "vitest";

// The repo module seeds itself from mock-data at import time; mock the fixtures
// so tests don't depend on the real seed contents.
vi.mock("./mock-data", () => ({
  mockFiles: [
    {
      id: "1",
      name: "Setup Wizard",
      type: "EXE",
      category: "Utilities",
      version: "v2.4",
      sizeLabel: "84 MB",
      uploadedAt: "2026-06-28",
    },
  ],
}));

import { mockFiles } from "./mock-data";
import { getFilesRepo } from "./files-repo";

describe("MockFilesRepo (via getFilesRepo)", () => {
  const repo = getFilesRepo();

  it("returns a singleton", () => {
    expect(getFilesRepo()).toBe(repo);
  });

  it("lists seeded files without exposing the fixture array", async () => {
    const files = await repo.list();
    expect(files).toHaveLength(1);
    // Mutating a returned copy must not corrupt repo state.
    files[0].name = "hacked";
    const again = await repo.list();
    expect(again[0].name).toBe("Setup Wizard");
    // And the exported fixture is never mutated by the repo.
    expect(mockFiles[0].name).toBe("Setup Wizard");
  });

  it("findByName is case-insensitive and trims", async () => {
    expect(await repo.findByName("  setup WIZARD ")).not.toBeNull();
    expect(await repo.findByName("nope")).toBeNull();
  });

  it("create prepends the new file and assigns an id/date", async () => {
    const created = await repo.create({
      name: "New Tool",
      category: "Productivity",
      version: "v1.0",
    });
    expect(created.id).toBeTruthy();
    expect(created.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const files = await repo.list();
    expect(files[0].name).toBe("New Tool");
    expect(await repo.findByName("new tool")).not.toBeNull();
  });
});
