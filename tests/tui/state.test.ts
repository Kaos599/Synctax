import { describe, expect, it } from "vitest";
import { TUI_ACTIONS } from "../../src/tui/actions.js";
import { createInitialTuiState, reduceTuiKey } from "../../src/tui/state.js";

describe("tui key reducer", () => {
  it("opens confirm mode for quick action hotkeys", () => {
    for (const action of TUI_ACTIONS) {
      const next = reduceTuiKey(createInitialTuiState(), action.hotkey);
      expect(next.state.mode).toBe("confirm");
      expect(next.state.pendingAction?.id).toBe(action.id);
      expect(next.effect.type).toBe("none");
    }
  });

  it("cancels confirm mode on escape and n", () => {
    const confirmState = reduceTuiKey(createInitialTuiState(), "1").state;

    const escapeNext = reduceTuiKey(confirmState, "\u001b");
    expect(escapeNext.state.mode).toBe("dashboard");
    expect(escapeNext.state.pendingAction).toBeUndefined();
    expect(escapeNext.effect.type).toBe("none");

    const nNext = reduceTuiKey(confirmState, "n");
    expect(nNext.state.mode).toBe("dashboard");
    expect(nNext.state.pendingAction).toBeUndefined();
    expect(nNext.effect.type).toBe("none");
  });

  it("emits run effect and exits confirm mode on enter, newline, or y", () => {
    const confirmState = reduceTuiKey(createInitialTuiState(), "1").state;

    const enterNext = reduceTuiKey(confirmState, "\r");
    expect(enterNext.effect.type).toBe("run-pending-action");
    expect(enterNext.state.mode).toBe("running");
    expect(enterNext.state.pendingAction).toBeUndefined();
    if (enterNext.effect.type !== "run-pending-action") {
      throw new Error("expected run-pending-action effect");
    }
    expect(enterNext.effect.action.id).toBe("sync");

    const newlineNext = reduceTuiKey(confirmState, "\n");
    expect(newlineNext.effect.type).toBe("run-pending-action");
    expect(newlineNext.state.mode).toBe("running");
    expect(newlineNext.state.pendingAction).toBeUndefined();
    if (newlineNext.effect.type !== "run-pending-action") {
      throw new Error("expected run-pending-action effect");
    }
    expect(newlineNext.effect.action.id).toBe("sync");

    const yNext = reduceTuiKey(confirmState, "y");
    expect(yNext.effect.type).toBe("run-pending-action");
    expect(yNext.state.mode).toBe("running");
    expect(yNext.state.pendingAction).toBeUndefined();
    if (yNext.effect.type !== "run-pending-action") {
      throw new Error("expected run-pending-action effect");
    }
    expect(yNext.effect.action.id).toBe("sync");
  });

  it("does not emit run effect for enter or y outside confirm mode", () => {
    const initial = createInitialTuiState();

    expect(reduceTuiKey(initial, "\r").effect.type).toBe("none");
    expect(reduceTuiKey(initial, "y").effect.type).toBe("none");
  });

  it("enters help mode with h and exits with ?", () => {
    const open = reduceTuiKey(createInitialTuiState(), "h");
    expect(open.state.mode).toBe("help");
    expect(open.state.showHelp).toBe(true);
    expect(open.state.statusLine).toBe("Help open");

    const closed = reduceTuiKey(open.state, "?");
    expect(closed.state.mode).toBe("dashboard");
    expect(closed.state.showHelp).toBe(false);
    expect(closed.state.statusLine).toBe("Help closed");
  });

  it("enters palette mode on slash key", () => {
    const next = reduceTuiKey(createInitialTuiState(), "/");
    expect(next.state.mode).toBe("palette");
    expect(next.state.statusLine).toBe("Search commands...");
    expect(next.effect.type).toBe("none");
  });

  it("emits exit effect for q and Ctrl-C", () => {
    expect(reduceTuiKey(createInitialTuiState(), "q").effect.type).toBe("exit");
    expect(reduceTuiKey(createInitialTuiState(), "\u0003").effect.type).toBe("exit");
  });

  it("ignores non-exit keys while running and only exits on q/Ctrl-C", () => {
    const runningState = {
      ...createInitialTuiState(),
      mode: "running" as const,
      statusLine: "Running sync...",
    };

    for (const key of ["1", "2", "\r", "\n", "y", "n", "\u001b", "h", "?", "/"]) {
      const next = reduceTuiKey(runningState, key);
      expect(next.state).toEqual(runningState);
      expect(next.effect.type).toBe("none");
    }

    expect(reduceTuiKey(runningState, "q").effect.type).toBe("exit");
    expect(reduceTuiKey(runningState, "\u0003").effect.type).toBe("exit");
  });
});
