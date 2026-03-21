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
    (search as any)
      .mockResolvedValueOnce("status" as any)
      .mockResolvedValueOnce("exit" as any);
    const statusSpy = vi.spyOn(commands, "statusCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(statusSpy).toHaveBeenCalled();
  });

  it("should call listCommand when list is selected", async () => {
    (search as any)
      .mockResolvedValueOnce("list" as any)
      .mockResolvedValueOnce("exit" as any);
    const listSpy = vi.spyOn(commands, "listCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(listSpy).toHaveBeenCalled();
  });

  it("should prompt for --from when pull is selected and call pullCommand", async () => {
    (search as any)
      .mockResolvedValueOnce("pull" as any)
      .mockResolvedValueOnce("exit" as any);
    (select as any).mockResolvedValue("claude" as any);
    
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined as any);
    
    await startInteractiveMode();
    
    expect(pullSpy).toHaveBeenCalledWith({ from: "claude", interactive: true });
    expect(select).toHaveBeenCalled();
  });

  it("should stay in interactive mode until exit", async () => {
    (search as any)
      .mockResolvedValueOnce("status" as any)
      .mockResolvedValueOnce("list" as any)
      .mockResolvedValueOnce("exit" as any);

    const statusSpy = vi.spyOn(commands, "statusCommand").mockResolvedValue(undefined as any);
    const listSpy = vi.spyOn(commands, "listCommand").mockResolvedValue(undefined as any);

    await startInteractiveMode();

    expect(statusSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(3);
  });
});
