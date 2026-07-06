import { describe, expect, it } from "vitest";
import { parseSizeLabelMB, formatStorageMB, computeFileStats } from "./stats";
import type { InstallerFile } from "./types";

describe("parseSizeLabelMB", () => {
  it("parses MB / GB / TB / KB", () => {
    expect(parseSizeLabelMB("84 MB")).toBe(84);
    expect(parseSizeLabelMB("1.5 GB")).toBe(1.5 * 1024);
    expect(parseSizeLabelMB("2 TB")).toBe(2 * 1024 * 1024);
    expect(parseSizeLabelMB("512 KB")).toBeCloseTo(0.5);
  });

  it("returns 0 for placeholders / junk", () => {
    expect(parseSizeLabelMB("—")).toBe(0);
    expect(parseSizeLabelMB("")).toBe(0);
    expect(parseSizeLabelMB("big")).toBe(0);
  });
});

describe("formatStorageMB", () => {
  it("scales to the largest sensible unit", () => {
    expect(formatStorageMB(512)).toBe("512 MB");
    expect(formatStorageMB(2048)).toBe("2.0 GB");
    expect(formatStorageMB(3 * 1024 * 1024)).toBe("3.0 TB");
  });
});

describe("computeFileStats", () => {
  it("derives total, storage and distinct formats from the data", () => {
    const files = [
      { type: "EXE", sizeLabel: "84 MB" },
      { type: "MSI", sizeLabel: "210 MB" },
      { type: "EXE", sizeLabel: "—" },
    ] as InstallerFile[];

    const stats = computeFileStats(files);
    expect(stats.total).toBe(3);
    expect(stats.storage).toBe("294 MB");
    expect(stats.formats).toBe(2);
  });
});
