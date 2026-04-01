# Fullscreen TUI with Confirmed Actions Design

Date: 2026-03-29
Status: Approved in-session

## Context

Synctax currently has a no-arg interactive mode built around command search prompts. A fullscreen TUI prototype now exists in `src/tui/frame.ts` and `src/tui/app.ts`, with a runnable demo in `examples/fullscreen-tui.ts`. The product direction is to make this fullscreen experience the primary no-arg UX for interactive terminals.

Session decisions captured here:

1. Fullscreen TUI is the target interaction model.
2. Quick actions should require confirmation before execution.
3. The interface should remain clean duotone and panel-based, with explicit fallback behavior for non-TTY contexts.

## Goals

1. Ship a keyboard-first fullscreen TUI as the default no-arg experience on interactive TTY terminals.
2. Add confirmation guardrails for quick actions (`1-6`) and palette-triggered command execution.
3. Execute real Synctax command handlers from inside the TUI (not shelling out nested CLI processes).
4. Keep failures recoverable in-app (no abrupt TUI termination on command errors).
5. Preserve clear fallback behavior for non-TTY and constrained terminal environments.

## Non-Goals

1. Persisting user TUI preferences across sessions (theme, layout density, per-action confirm policy).
2. Implementing advanced multiplexed panes, split logs, or plugin-style panel injection.
3. Replacing all existing interactive prompt flows in one step; staged migration is acceptable.

## UX Principles

1. **Safe by default:** any action that mutates state must show explicit confirmation before run.
2. **Fast by keyboard:** direct keypaths for frequent tasks remain first-class.
3. **Context always visible:** action intent, command identity, and resulting status remain on screen.
4. **Graceful degradation:** non-TTY paths remain usable and deterministic.
5. **Single visual language:** strict duotone palette with minimal accent use.

## Architecture

### Module boundaries

1. `src/tui/frame.ts` remains a pure render layer:
   - accepts data + state,
   - renders dashboard, overlays, footer/status,
   - contains no command side effects.
2. `src/tui/app.ts` remains the app runtime/state machine:
   - key handling,
   - mode transitions,
   - command orchestration,
   - redraw scheduling.
3. Introduce `src/tui/actions.ts` as a shared action registry:
   - action id,
   - label and short description,
   - handler binding metadata,
   - risk/impact hint,
   - optional confirmation copy.

### Entry routing

1. No-arg CLI entry (`bin/synctax.ts`) routes to fullscreen TUI when `stdin` and `stdout` are interactive TTYs with adequate viewport.
2. On non-TTY or insufficient viewport, route to compact fallback (existing interactive search flow or concise static status view) with explicit reason in output.
3. Keep route logic centralized to avoid divergent behavior between direct CLI invocation and test harness runs.

## State Model

### Core modes

1. `dashboard`: normal browsing and navigation.
2. `confirm`: modal overlay for pending action execution.
3. `running`: action in progress with live status/output area.
4. `result`: completion state (success/warn/error) with return hint.

### State shape (conceptual)

1. `focus`: current panel focus.
2. `pendingAction`: selected action awaiting confirmation.
3. `runState`: idle/running/succeeded/failed.
4. `statusLine`: concise, high-signal status text.
5. `outputLines`: bounded buffer of latest command output lines.
6. `showHelp`: keyboard help overlay toggle.

## Interaction Design

### Quick actions

1. Pressing `1-6` selects mapped action and opens confirmation modal.
2. Pressing `/` opens palette; selecting an executable action also opens confirmation modal.

### Confirmation modal

Modal content includes:

1. Action title.
2. Exact command intent (for example, `synctax sync`).
3. Impact/risk hint.
4. Key hints:
   - `Enter` or `y`: confirm and run
   - `Esc` or `n`: cancel

On cancel, return to prior focus state and post a clear cancellation status.

### Running and completion

1. On confirm, app enters `running` mode and displays progress/output.
2. On success, display completion summary and last action metadata.
3. On failure, show concise error summary + troubleshooting hint while staying in TUI.
4. User remains in control; only explicit quit (`q` or Ctrl-C) exits the app.

## Command Execution Strategy

1. Execute internal command functions directly (same logic used by CLI command handlers).
2. Wrap each run in a guarded executor:
   - capture start/end time,
   - normalize thrown errors,
   - map run result to TUI result state,
   - ensure cleanup and redraw consistency.
3. Keep a bounded output buffer to prevent unbounded memory usage in long-running commands.
4. Avoid nested process spawning for core actions to preserve predictable behavior and testability.

## Error Handling and Recovery

1. Action-level failure must never crash the TUI loop.
2. Convert exceptions into structured UI states with explicit severity (`WARN`/`FAIL`).
3. Keep terminal state restoration robust on exit (raw mode off, handlers detached, cursor reset).
4. For unsupported environments, fall back before entering raw mode.

## Testing Strategy

### Unit tests

1. `tests/tui/frame.test.ts`
   - render assertions for `confirm`, `running`, and `result` variants,
   - modal copy and key hint visibility,
   - duotone/styling stability constraints where testable.

2. `tests/tui/app.test.ts` (new)
   - key transition tests (`1` -> `confirm`, `Enter` -> `running`, `Esc` -> cancel),
   - guarded executor behavior on success/failure,
   - output buffer truncation behavior.

### Integration tests

1. Entry routing tests for no-arg CLI with TTY/non-TTY conditions.
2. Regression tests proving command failures do not terminate the TUI unexpectedly.
3. Fallback-path tests proving deterministic non-TTY output.

### Verification gates

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## Rollout Plan

1. Implement state/mode model + confirm modal without command wiring changes.
2. Add action registry and wire quick actions + palette to confirm flow.
3. Integrate internal command execution + run/result states.
4. Wire no-arg CLI entry routing to fullscreen-first with fallback.
5. Run full verification gates and tune UX copy/spacing based on snapshot output.

## Acceptance Criteria

1. No-arg interactive TTY launch enters fullscreen TUI by default.
2. Any quick action execution path requires explicit confirmation.
3. Successful actions show completion status without leaving TUI.
4. Failed actions show recoverable error state without terminating TUI.
5. Non-TTY launch follows fallback path and never attempts raw-mode behavior.
6. Typecheck, lint, and test gates pass.
