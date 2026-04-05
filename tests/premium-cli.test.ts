import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

let mockHome: string;

beforeEach(async () => {
  mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-premium-cli-"));
  process.env.SYNCTAX_HOME = mockHome;
});

afterEach(async () => {
  await fs.rm(mockHome, { recursive: true, force: true });
  delete process.env.SYNCTAX_HOME;
  vi.restoreAllMocks();
});

describe("Premium CLI - Version", () => {
  it("getVersion returns a semver string", async () => {
    const { getVersion } = await import("../src/version.js");
    const v = getVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("Premium CLI - Brand Header", () => {
  it("format.brandHeader includes version and profile", async () => {
    const { format } = await import("../src/ui/output.js");
    const { getVersion } = await import("../src/version.js");
    const v = getVersion();
    const header = format.brandHeader(v, "work");
    expect(header).toContain("Synctax");
    expect(header).toContain(`v${v}`);
    expect(header).toContain("Profile: work");
  });

  it("format.brandHeader works without profile", async () => {
    const { format } = await import("../src/ui/output.js");
    const { getVersion } = await import("../src/version.js");
    const v = getVersion();
    const header = format.brandHeader(v);
    expect(header).toContain(`v${v}`);
    expect(header).not.toContain("Profile:");
  });
});

describe("Premium CLI - Summary", () => {
  it("format.summary includes elapsed time and detail", async () => {
    const { format } = await import("../src/ui/output.js");
    const summary = format.summary("42ms", "3 clients synced");
    expect(summary).toContain("Done in 42ms");
    expect(summary).toContain("3 clients synced");
  });
});

describe("Premium CLI - Timer", () => {
  it("startTimer returns elapsed time", async () => {
    const { startTimer } = await import("../src/ui/timer.js");
    const timer = startTimer();
    // Wait a tiny bit
    await new Promise(resolve => setTimeout(resolve, 5));
    const elapsed = timer.elapsed();
    expect(elapsed).toMatch(/^\d+ms$/);
    expect(timer.elapsedMs()).toBeGreaterThan(0);
  });
});

describe("Premium CLI - Spinner", () => {
  it("spinner succeed/fail/warn output formatted lines", async () => {
    const { spinner } = await import("../src/ui/spinner.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const spin = spinner("test");
    spin.succeed("done!");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("done!"));

    logSpy.mockClear();
    const spin2 = spinner("test2");
    spin2.fail("oops");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("oops"));

    logSpy.mockClear();
    const spin3 = spinner("test3");
    spin3.warn("careful");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("careful"));
  });
});

describe("Premium CLI - Command Brand Headers", () => {
  async function setupConfig() {
    const configDir = path.join(mockHome, ".synctax");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "config.json"),
      JSON.stringify({
        version: 1,
        source: "claude",
        theme: "rebel",
        activeProfile: "test-profile",
        clients: {},
        profiles: { default: {}, "test-profile": {} },
        resources: {
          mcps: { "test-mcp": { command: "npx", args: ["-y", "test-server"] } },
          agents: {},
          skills: {},
        },
      }),
      "utf-8"
    );
  }

  it("syncCommand outputs brand header and summary", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { syncCommand } = await import("../src/commands/sync.js");
    await syncCommand({});

    const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(allOutput).toContain("Synctax");
    const { getVersion } = await import("../src/version.js");
    expect(allOutput).toContain(`v${getVersion()}`);
    expect(allOutput).toContain("test-profile");
    expect(allOutput).toContain("Done in");
  });

  it("listCommand outputs deprecation hint", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { listCommand } = await import("../src/commands/info.js");
    await listCommand();

    const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(allOutput).toContain("synctax status");
  });

  it("infoCommand outputs deprecation hint", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock adapters to avoid real file system detection
    const adaptersModule = await import("../src/adapters/index.js");
    const originalAdapters = { ...adaptersModule.adapters };
    // Clear adapters to avoid detecting real clients
    for (const key of Object.keys(adaptersModule.adapters)) {
      delete adaptersModule.adapters[key];
    }

    try {
      const { infoCommand } = await import("../src/commands/info.js");
      await infoCommand();

      const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
      expect(allOutput).toContain("synctax status");
    } finally {
      // Restore adapters
      for (const [key, val] of Object.entries(originalAdapters)) {
        adaptersModule.adapters[key] = val;
      }
    }
  });

  it("addCommand outputs brand header and summary", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { addCommand } = await import("../src/commands/manage.js");
    await addCommand("mcp", "new-mcp", { command: "npx" });

    const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(allOutput).toContain("Synctax");
    expect(allOutput).toContain("Done in");
    expect(allOutput).toContain("Added mcp new-mcp");
  });

  it("profileCreateCommand outputs brand header and summary", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { profileCreateCommand } = await import("../src/commands/profile.js");
    await profileCreateCommand("new-profile", {});

    const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(allOutput).toContain("Synctax");
    expect(allOutput).toContain("Done in");
    expect(allOutput).toContain("Profile new-profile created");
  });

  it("exportCommand outputs brand header and summary", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const exportPath = path.join(mockHome, "export.json");
    const { exportCommand } = await import("../src/commands/io.js");
    await exportCommand(exportPath);

    const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(allOutput).toContain("Synctax");
    expect(allOutput).toContain("Done in");
    expect(allOutput).toContain("Exported");
  });

  it("doctorCommand outputs brand header and summary", async () => {
    await setupConfig();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { doctorCommand } = await import("../src/commands/info.js");
    await doctorCommand({});

    const allOutput = logSpy.mock.calls.map(c => c[0]).join("\n");
    expect(allOutput).toContain("Synctax");
    expect(allOutput).toContain("Done in");
  });
});
