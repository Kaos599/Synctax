import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startInteractiveMode } from "../src/interactive.js";
import * as commands from "../src/commands.js";
import { search, input, select } from "@inquirer/prompts";
import { ConfigManager } from "../src/config.js";

vi.mock("@inquirer/prompts", () => ({
  search: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}));

describe("Interactive Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call statusCommand when status is selected", async () => {
    vi.mocked(search).mockResolvedValue("status" as any);
    const statusSpy = vi.spyOn(commands, "statusCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(statusSpy).toHaveBeenCalled();
  });

  it("should call listCommand when list is selected", async () => {
    vi.mocked(search).mockResolvedValue("list" as any);
    const listSpy = vi.spyOn(commands, "listCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(listSpy).toHaveBeenCalled();
  });

  it("should prompt for --from when pull is selected and call pullCommand", async () => {
    vi.mocked(search).mockResolvedValue("pull" as any);
    vi.mocked(select).mockResolvedValue("claude" as any);
    
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(pullSpy).toHaveBeenCalledWith({ from: "claude", interactive: true });
    expect(select).toHaveBeenCalled();
  });

  it("should handle ExitPromptError from initial search gracefully", async () => {
    const exitError = new Error("User force closed the prompt");
    exitError.name = "ExitPromptError";
    vi.mocked(search).mockRejectedValue(exitError);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(startInteractiveMode()).resolves.toBeUndefined();
    expect(consoleSpy.mock.calls.some(c => String(c[0]).includes("Cancelled"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("should handle CancelPromptError from sub-prompt gracefully", async () => {
    vi.mocked(search).mockResolvedValue("pull" as any);
    const cancelError = new Error("Prompt was cancelled");
    cancelError.name = "CancelPromptError";
    vi.mocked(select).mockRejectedValue(cancelError);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(startInteractiveMode()).resolves.toBeUndefined();
    expect(consoleSpy.mock.calls.some(c => String(c[0]).includes("Cancelled"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("should propagate non-cancellation errors", async () => {
    const genericError = new Error("Something broke");
    vi.mocked(search).mockRejectedValue(genericError);

    await expect(startInteractiveMode()).rejects.toThrow("Something broke");
  });
});
