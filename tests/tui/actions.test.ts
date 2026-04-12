import { afterEach, describe, expect, it, vi } from "vitest";
import * as commands from "../../src/commands.js";
import { TUI_ACTIONS, getActionByHotkey, runActionById } from "../../src/tui/actions.js";

describe("tui actions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defines 12 quick actions with ordered hotkeys and confirmation metadata", () => {
    expect(TUI_ACTIONS).toHaveLength(12);
    expect(TUI_ACTIONS.map((action) => action.hotkey)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "!", "@"]);
    expect(TUI_ACTIONS.every((action) => action.confirmTitle.length > 0)).toBe(true);
    expect(TUI_ACTIONS.every((action) => action.commandPreview.length > 0)).toBe(true);
    expect(TUI_ACTIONS.every((action) => action.confirmRisk === "low" || action.confirmRisk === "medium")).toBe(true);
    expect(TUI_ACTIONS.every((action) => action.focus === "actions")).toBe(true);
  });

  it("resolves action by hotkey", () => {
    expect(getActionByHotkey("1")?.id).toBe("sync");
    expect(getActionByHotkey("6")?.id).toBe("backup");
    expect(getActionByHotkey("x")).toBeUndefined();
  });

  it("dispatches sync action to syncCommand", async () => {
    const syncSpy = vi.spyOn(commands, "syncCommand").mockResolvedValue(undefined);

    await runActionById("sync", { source: "cursor" });

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy).toHaveBeenCalledWith({ yes: true });
  });

  it("dispatches pull action with provided source", async () => {
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined);

    await runActionById("pull", { source: "cursor" });

    expect(pullSpy).toHaveBeenCalledTimes(1);
    expect(pullSpy).toHaveBeenCalledWith({ from: "cursor", merge: true });
  });

  it("dispatches pull action with claude fallback when source missing", async () => {
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined);

    await runActionById("pull", {});

    expect(pullSpy).toHaveBeenCalledTimes(1);
    expect(pullSpy).toHaveBeenCalledWith({ from: "claude", merge: true });
  });

  it("fails fast for pull action when configured source is invalid", async () => {
    const pullSpy = vi.spyOn(commands, "pullCommand").mockResolvedValue(undefined);

    await expect(
      runActionById("pull", { invalidSource: "invalid-client" }),
    ).rejects.toThrow("Invalid source 'invalid-client' configured for pull action.");

    expect(pullSpy).not.toHaveBeenCalled();
  });

  it("dispatches profile action to profileListCommand", async () => {
    const profileSpy = vi.spyOn(commands, "profileListCommand").mockResolvedValue(undefined);

    await runActionById("profile", { source: "cursor" });

    expect(profileSpy).toHaveBeenCalledTimes(1);
    expect(profileSpy).toHaveBeenCalledWith({});
  });

  it("dispatches diff action to diffCommand", async () => {
    const diffSpy = vi.spyOn(commands, "diffCommand").mockResolvedValue(undefined);

    await runActionById("diff", { source: "cursor" });

    expect(diffSpy).toHaveBeenCalledTimes(1);
    expect(diffSpy).toHaveBeenCalledWith(undefined, {});
  });

  it("dispatches validate action to validateCommand", async () => {
    const validateSpy = vi.spyOn(commands, "validateCommand").mockResolvedValue(true);

    await runActionById("validate", { source: "cursor" });

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledWith({});
  });

  it("dispatches backup action to backupCommand", async () => {
    const backupSpy = vi.spyOn(commands, "backupCommand").mockResolvedValue({
      layout: "bundle",
      selectedClientIds: [],
      artifacts: [],
      clientResults: [],
      createdAt: new Date(0).toISOString(),
    });

    await runActionById("backup", { source: "cursor" });

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(backupSpy).toHaveBeenCalledWith({});
  });

  it("TUI-02: TUI_ACTIONS includes non-numeric hotkeys ! and @", () => {
    const hotkeys = TUI_ACTIONS.map((a) => a.hotkey);
    expect(hotkeys).toContain("!");
    expect(hotkeys).toContain("@");

    const bangAction = getActionByHotkey("!");
    const atAction = getActionByHotkey("@");
    expect(bangAction).toBeDefined();
    expect(atAction).toBeDefined();
    expect(bangAction!.id).toBeTruthy();
    expect(atAction!.id).toBeTruthy();
  });
});
