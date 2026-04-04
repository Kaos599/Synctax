/**
 * TUI state reducer — pure key-handling logic.
 *
 * With the Ink migration, state management is primarily handled via
 * React hooks in components/App.tsx. This module is retained for tests
 * that verify key-transition logic independently of the React layer.
 */
import { getActionByHotkey } from "./actions.js";
import type { TuiMode, TuiFocus, TuiPendingAction } from "./ink-types.js";

export interface TuiFrameState {
  mode: TuiMode;
  focus: TuiFocus;
  statusLine: string;
  showHelp: boolean;
  nowLabel: string;
  pendingAction?: TuiPendingAction;
}

export type TuiReducerEffect =
  | { type: "none" }
  | { type: "exit" }
  | { type: "run-pending-action"; action: TuiPendingAction };

export interface TuiReducerResult {
  state: TuiFrameState;
  effect: TuiReducerEffect;
}

const NO_EFFECT: TuiReducerEffect = { type: "none" };

export function createInitialTuiState(): TuiFrameState {
  return {
    mode: "dashboard",
    focus: "overview",
    statusLine: "Ready.",
    showHelp: false,
    nowLabel: "",
  };
}

export function reduceTuiKey(state: TuiFrameState, key: string): TuiReducerResult {
  if (key === "q" || key === "\u0003") {
    return {
      state,
      effect: { type: "exit" },
    };
  }

  if (state.mode === "running") {
    return { state, effect: NO_EFFECT };
  }

  const action = getActionByHotkey(key);
  if (action && state.mode === "dashboard") {
    return {
      state: {
        ...state,
        mode: "confirm",
        focus: action.focus,
        pendingAction: {
          id: action.id,
          hotkey: action.hotkey,
          label: action.label,
          commandPreview: action.commandPreview,
          confirmTitle: action.confirmTitle,
          confirmRisk: action.confirmRisk,
          description: action.description,
          hint: action.hint,
        },
        statusLine: `Would run: ${action.commandPreview}`,
      },
      effect: NO_EFFECT,
    };
  }

  if ((key === "\u001b" || key === "n") && state.mode === "confirm") {
    return {
      state: {
        ...state,
        mode: "dashboard",
        pendingAction: undefined,
        statusLine: "Cancelled.",
      },
      effect: NO_EFFECT,
    };
  }

  if ((key === "\r" || key === "\n" || key === "y") && state.mode === "confirm" && state.pendingAction) {
    return {
      state: {
        ...state,
        mode: "running",
        pendingAction: undefined,
      },
      effect: { type: "run-pending-action", action: state.pendingAction },
    };
  }

  if ((key === "h" || key === "?") && state.mode === "dashboard") {
    return {
      state: {
        ...state,
        mode: "help",
        showHelp: true,
        statusLine: "Help open",
      },
      effect: NO_EFFECT,
    };
  }

  if ((key === "h" || key === "?" || key === "\u001b") && state.mode === "help") {
    return {
      state: {
        ...state,
        mode: "dashboard",
        showHelp: false,
        statusLine: "Help closed",
      },
      effect: NO_EFFECT,
    };
  }

  if (key === "/" && state.mode === "dashboard") {
    return {
      state: {
        ...state,
        mode: "palette",
        statusLine: "Search commands...",
      },
      effect: NO_EFFECT,
    };
  }

  return { state, effect: NO_EFFECT };
}
