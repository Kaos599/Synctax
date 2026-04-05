import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startInteractiveMode } from "../src/interactive.js";
import * as commands from "../src/commands.js";
import { search, input, select } from "@inquirer/prompts";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

vi.mock("@inquirer/prompts", () => ({
  search: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}));

function promptError(name: "ExitPromptError" | "CancelPromptError" | "AbortPromptError", message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

function mockCommandThenExit(command: string): void {
  vi.mocked(search)
    .mockResolvedValueOnce(command as any)
    .mockRejectedValueOnce(promptError("ExitPromptError", "Exit interactive") as any);
}

describe("Interactive Mode", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-interactive-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });

    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {},
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);

    vi.clearAllMocks();
    vi.mocked(search).mockReset();
    vi.mocked(input).mockReset();
    vi.mocked(select).mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("returns to menu loop after command execution", async () => {
    vi.mocked(search)
      .mockResolvedValueOnce("status" as any)
      .mockResolvedValueOnce("list" as any)
      .mockRejectedValueOnce(promptError("ExitPromptError", "Exit interactive") as any);

    const statusSpy = vi.spyOn(commands, "statusCommand").mockResolvedValue(undefined as any);
    const listSpy = vi.spyOn(commands, "listCommand").mockResolvedValue(undefined as any);

    await startInteractiveMode();

    expect(statusSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(3);
  });

  it("should call statusCommand when status is selected", async () => {
    mockCommandThenExit("status");
    const statusSpy = vi.spyOn(commands, "statusCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(statusSpy).toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("should call listCommand when list is selected", async () => {
    mockCommandThenExit("list");
    const listSpy = vi.spyOn(commands, "listCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(listSpy).toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("should prompt for --from when pull is selected and call pullCommand", async () => {
    mockCommandThenExit("pull");
    vi.mocked(select).mockResolvedValue("claude" as any);
    
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(pullSpy).toHaveBeenCalledWith({ from: "claude", interactive: true });
    expect(select).toHaveBeenCalled();
  });

  it("should call profileListCommand when profile list is selected", async () => {
    mockCommandThenExit("profile:list");
    const listSpy = vi.spyOn(commands, "profileListCommand").mockResolvedValue(undefined as any);

    await startInteractiveMode();

    expect(listSpy).toHaveBeenCalledWith({});
  });

  it("should select profile and call profileDiffCommand when profile diff is selected", async () => {
    mockCommandThenExit("profile:diff");
    vi.mocked(select).mockResolvedValue("default" as any);
    const diffSpy = vi.spyOn(commands, "profileDiffCommand").mockResolvedValue(undefined as any);

    await startInteractiveMode();

    expect(select).toHaveBeenCalled();
    expect(diffSpy).toHaveBeenCalledWith("default", {});
  });

  it("profile:diff exits early when no config and does not call select/profileDiffCommand", async () => {
    await fs.writeFile(path.join(mockHome, ".synctax", "config.json"), "{invalid-json", "utf-8");

    mockCommandThenExit("profile:diff");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const diffSpy = vi.spyOn(commands, "profileDiffCommand").mockResolvedValue(undefined as any);

    await startInteractiveMode();

    expect(select).not.toHaveBeenCalled();
    expect(diffSpy).not.toHaveBeenCalled();
    expect(consoleSpy.mock.calls.some((c) => String(c[0]).includes("No configuration found. Please initialize first."))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("profile:diff exits early when no profiles and does not call select/profileDiffCommand", async () => {
    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {},
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);

    mockCommandThenExit("profile:diff");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const diffSpy = vi.spyOn(commands, "profileDiffCommand").mockResolvedValue(undefined as any);

    await startInteractiveMode();

    expect(select).not.toHaveBeenCalled();
    expect(diffSpy).not.toHaveBeenCalled();
    expect(consoleSpy.mock.calls.some((c) => String(c[0]).includes("No profiles found."))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("pull exits early when no adapter choices and avoids select/pullCommand", async () => {
    const originalAdapters = Object.entries(adapters).map(([id, adapter]) => [id, adapter] as const);
    for (const [id] of originalAdapters) {
      (adapters as any)[id] = undefined;
    }

    mockCommandThenExit("pull");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined as any);

    try {
      await startInteractiveMode();

      expect(select).not.toHaveBeenCalled();
      expect(pullSpy).not.toHaveBeenCalled();
      expect(consoleSpy.mock.calls.some((c) => String(c[0]).includes("No clients available to pull from."))).toBe(true);
    } finally {
      for (const [id, adapter] of originalAdapters) {
        (adapters as any)[id] = adapter;
      }
      consoleSpy.mockRestore();
    }
  });

  it("should handle ExitPromptError from initial search gracefully", async () => {
    const exitError = promptError("ExitPromptError", "User force closed the prompt");
    vi.mocked(search).mockRejectedValue(exitError);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(startInteractiveMode()).resolves.toBeUndefined();
    expect(consoleSpy.mock.calls.some(c => String(c[0]).includes("Cancelled"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("should handle CancelPromptError from sub-prompt gracefully", async () => {
    vi.mocked(search).mockResolvedValue("pull" as any);
    const cancelError = promptError("CancelPromptError", "Prompt was cancelled");
    vi.mocked(select).mockRejectedValue(cancelError);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(startInteractiveMode()).resolves.toBeUndefined();
    expect(consoleSpy.mock.calls.some(c => String(c[0]).includes("Cancelled"))).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("should propagate non-cancellation errors", async () => {
    const genericError = new Error("Something broke");
    vi.mocked(search).mockRejectedValue(genericError);

    await expect(startInteractiveMode()).rejects.toThrow("Something broke");
  });
});
