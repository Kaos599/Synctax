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
});
