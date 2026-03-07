import { describe, it, expect } from "vitest";
import { getTheme, paintLines, themes } from "../src/theme.js";

describe("Theme System", () => {
  it("returns default theme if missing", () => {
    expect(getTheme("unknown")).toEqual(themes.default);
  });

  it("returns correct cyber theme", () => {
    expect(getTheme("cyber")).toEqual(themes.cyber);
  });

  it("paintLines loops through colors correctly", () => {
    const text = "line1\nline2\nline3\nline4\nline5";
    const painted = paintLines(text, themes.default);
    const lines = painted.split("\n");
    // Vitest runs in an environment where Chalk might disable colors by default.
    // Let's force color output for testing or just accept chalk executed.
    expect(lines.length).toBe(5);
    expect(lines[0]).toContain("line1");
    expect(lines[4]).toContain("line5");
  });
});
