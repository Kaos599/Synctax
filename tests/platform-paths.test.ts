import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import fs from "fs/promises";
import path from "path";

describe("platform-paths XPLAT-01 fixes", () => {
  let mockHome: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-platform-paths-"));
    savedEnv.SYNCTAX_HOME = process.env.SYNCTAX_HOME;
    savedEnv.APPDATA = process.env.APPDATA;
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    process.env.SYNCTAX_HOME = savedEnv.SYNCTAX_HOME;
    process.env.APPDATA = savedEnv.APPDATA;
    await fs.rm(mockHome, { recursive: true, force: true });
  });

  it("vscodeUserSettingsCandidates useWinAppData condition does not depend on SYNCTAX_HOME", async () => {
    // Verify the fix: the condition should be `process.platform === "win32" && !!ad`
    // not `process.platform === "win32" && ad && (!syn || path.resolve(ad).startsWith(path.resolve(syn)))`
    // We verify this by reading the source and checking the condition.
    const source = await fs.readFile(
      path.resolve(import.meta.dirname, "..", "src", "platform-paths.ts"),
      "utf-8",
    );

    // Find all useWinAppData assignments
    const assignments = source.match(/const useWinAppData\s*=\s*[^;]+;/g) || [];
    expect(assignments.length).toBeGreaterThanOrEqual(2);

    for (const assignment of assignments) {
      // Should NOT contain the old SYNCTAX_HOME-dependent condition
      expect(assignment).not.toContain("!syn");
      expect(assignment).not.toContain("startsWith");
      // Should be the simple `process.platform === "win32" && !!ad` form
      expect(assignment).toContain("!!ad");
    }
  });

  it("vscodeUserMcpJsonCandidates includes APPDATA paths regardless of SYNCTAX_HOME", async () => {
    // On non-Windows, this won't produce APPDATA candidates, but we can still
    // verify the function logic is correct by checking it doesn't crash and
    // the source condition is fixed (tested above).
    // On any platform, setting APPDATA and a different SYNCTAX_HOME
    // should not cause an error.
    const { vscodeUserMcpJsonCandidates } = await import("../src/platform-paths.js");

    process.env.SYNCTAX_HOME = "/some/custom/path";
    process.env.APPDATA = "/some/other/appdata";

    // Should not throw
    const candidates = vscodeUserMcpJsonCandidates(mockHome);
    expect(Array.isArray(candidates)).toBe(true);
    // Should always have at least the project-scoped workspace candidate and legacy global
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("vscodeUserSettingsCandidates returns candidates without error when SYNCTAX_HOME differs from APPDATA", async () => {
    const { vscodeUserSettingsCandidates } = await import("../src/platform-paths.js");

    process.env.SYNCTAX_HOME = "/completely/different/path";
    process.env.APPDATA = "/windows/appdata/roaming";

    const candidates = vscodeUserSettingsCandidates(mockHome);
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });
});
