# Fullscreen TUI Confirmed Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a fullscreen no-arg TUI that confirms quick actions before execution, runs real Synctax command handlers, and falls back safely outside interactive TTY contexts.

**Architecture:** Keep rendering pure in `src/tui/frame.ts`, move key transition logic into a testable state reducer, and isolate command execution in a guarded executor that captures output without breaking fullscreen redraws. Add a dedicated no-arg routing layer that chooses fullscreen TUI for suitable terminals and uses the existing prompt-based interactive mode as fallback.

**Tech Stack:** Bun, TypeScript (strict), Commander, Chalk, @inquirer/prompts, Vitest.

---

## Execution Skills

- `@superpowers:executing-plans`
- `@test-driven-development`
- `@verification-before-completion`

### Task 1: Add shared TUI action registry

**Files:**
- Create: `src/tui/actions.ts`
- Test: `tests/tui/actions.test.ts`
- Modify: `src/tui/frame.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { TUI_ACTIONS, getActionByHotkey } from "../../src/tui/actions.js";

describe("tui actions", () => {
  it("defines 6 quick actions with confirmation metadata", () => {
    expect(TUI_ACTIONS).toHaveLength(6);
    expect(TUI_ACTIONS.map((a) => a.hotkey)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(TUI_ACTIONS.every((a) => a.confirmTitle.length > 0)).toBe(true);
  });

  it("resolves action by hotkey", () => {
    expect(getActionByHotkey("1")?.id).toBe("sync");
    expect(getActionByHotkey("x")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/actions.test.ts`
Expected: FAIL with module/file not found for `src/tui/actions.ts`.

**Step 3: Write minimal implementation**

```ts
export type TuiActionId = "sync" | "pull" | "profile" | "diff" | "validate" | "backup";

export interface TuiAction {
  id: TuiActionId;
  hotkey: "1" | "2" | "3" | "4" | "5" | "6";
  label: string;
  commandPreview: string;
  confirmTitle: string;
  confirmRisk: "low" | "medium";
}

export const TUI_ACTIONS: TuiAction[] = [
  { id: "sync", hotkey: "1", label: "Sync", commandPreview: "synctax sync", confirmTitle: "Run sync now?", confirmRisk: "medium" },
  // ...5 more actions...
];

export function getActionByHotkey(key: string): TuiAction | undefined {
  return TUI_ACTIONS.find((a) => a.hotkey === key);
}
```

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/actions.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/actions.ts tests/tui/actions.test.ts src/tui/frame.ts
git commit -m "feat(tui): add shared quick action registry"
```

### Task 2: Render confirmation modal in fullscreen frame

**Files:**
- Modify: `src/tui/frame.ts`
- Modify: `tests/tui/frame.test.ts`

**Step 1: Write the failing test**

```ts
it("renders confirm modal content when mode is confirm", () => {
  const state = {
    ...sampleState(),
    mode: "confirm",
    pendingAction: {
      label: "Sync",
      commandPreview: "synctax sync",
      confirmTitle: "Run sync now?",
      confirmRisk: "medium",
    },
  } as any;

  const frame = renderTuiFrame(sampleData(), state, { width: 120, height: 36 });
  expect(frame).toContain("Run sync now?");
  expect(frame).toContain("synctax sync");
  expect(frame).toContain("Enter/y");
  expect(frame).toContain("Esc/n");
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/frame.test.ts -t "confirm modal"`
Expected: FAIL because `mode`/`pendingAction` not rendered.

**Step 3: Write minimal implementation**

```ts
type TuiMode = "dashboard" | "confirm" | "running" | "result";

function renderConfirmModal(state: TuiFrameState, width: number): string[] {
  if (state.mode !== "confirm" || !state.pendingAction) return [];
  return box("Confirm", [
    state.pendingAction.confirmTitle,
    state.pendingAction.commandPreview,
    "Enter/y: run",
    "Esc/n: cancel",
  ], Math.min(width - 4, 72), true);
}
```

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/frame.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/frame.ts tests/tui/frame.test.ts
git commit -m "feat(tui): render confirmation modal in fullscreen frame"
```

### Task 3: Extract testable key-state reducer

**Files:**
- Create: `src/tui/state.ts`
- Modify: `src/tui/app.ts`
- Test: `tests/tui/app.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createInitialTuiState, reduceTuiKey } from "../../src/tui/state.js";

describe("tui key reducer", () => {
  it("opens confirm mode when quick action key is pressed", () => {
    const state = createInitialTuiState();
    const next = reduceTuiKey(state, "1");
    expect(next.state.mode).toBe("confirm");
    expect(next.state.pendingAction?.id).toBe("sync");
  });

  it("cancels confirm mode on escape", () => {
    const state = reduceTuiKey(createInitialTuiState(), "1").state;
    const next = reduceTuiKey(state, "\u001b");
    expect(next.state.mode).toBe("dashboard");
    expect(next.state.pendingAction).toBeUndefined();
  });
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/app.test.ts`
Expected: FAIL because reducer functions do not exist.

**Step 3: Write minimal implementation**

```ts
export function createInitialTuiState(): TuiAppState {
  return { mode: "dashboard", focus: "overview", statusLine: "Ready.", showHelp: false } as TuiAppState;
}

export function reduceTuiKey(state: TuiAppState, key: string): ReduceResult {
  const action = getActionByHotkey(key);
  if (action) {
    return { state: { ...state, mode: "confirm", pendingAction: action }, effect: "none" };
  }
  if ((key === "\u001b" || key === "n") && state.mode === "confirm") {
    return { state: { ...state, mode: "dashboard", pendingAction: undefined, statusLine: "Cancelled." }, effect: "none" };
  }
  return { state, effect: "none" };
}
```

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/app.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/state.ts src/tui/app.ts tests/tui/app.test.ts
git commit -m "refactor(tui): add pure key reducer for mode transitions"
```

### Task 4: Add guarded command executor with output capture

**Files:**
- Create: `src/tui/executor.ts`
- Modify: `src/tui/app.ts`
- Test: `tests/tui/executor.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { runGuardedAction } from "../../src/tui/executor.js";

describe("tui executor", () => {
  it("captures console output and returns success", async () => {
    const result = await runGuardedAction("sync", async () => {
      console.log("line-1");
    });
    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("line-1");
  });

  it("captures thrown errors as failed result", async () => {
    const result = await runGuardedAction("sync", async () => {
      throw new Error("boom");
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("boom");
  });
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/executor.test.ts`
Expected: FAIL because executor file/function is missing.

**Step 3: Write minimal implementation**

```ts
export async function runGuardedAction(actionId: string, handler: () => Promise<void>) {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    output.push(args.map((a) => String(a)).join(" "));
  };

  const startedAt = Date.now();
  try {
    await handler();
    return { ok: true, output, elapsedMs: Date.now() - startedAt };
  } catch (error: any) {
    return { ok: false, output, elapsedMs: Date.now() - startedAt, error: error?.message || String(error), actionId };
  } finally {
    console.log = originalLog;
  }
}
```

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/executor.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/executor.ts src/tui/app.ts tests/tui/executor.test.ts
git commit -m "feat(tui): add guarded executor for in-app command runs"
```

### Task 5: Wire quick actions to real command handlers

**Files:**
- Modify: `src/tui/actions.ts`
- Create: `src/tui/runtime-context.ts`
- Test: `tests/tui/actions.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import * as commands from "../../src/commands.js";
import { runActionById } from "../../src/tui/actions.js";

describe("tui action dispatch", () => {
  it("dispatches sync action to syncCommand", async () => {
    const syncSpy = vi.spyOn(commands, "syncCommand").mockResolvedValue(undefined as any);
    await runActionById("sync", { source: "cursor" });
    expect(syncSpy).toHaveBeenCalledWith({});
  });
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/actions.test.ts -t "dispatches sync action"`
Expected: FAIL because dispatcher is not implemented.

**Step 3: Write minimal implementation**

```ts
export async function runActionById(id: TuiActionId, ctx: { source?: string }): Promise<void> {
  switch (id) {
    case "sync":
      await syncCommand({});
      return;
    case "pull":
      await pullCommand({ from: ctx.source || "claude", merge: true });
      return;
    case "profile":
      await profileListCommand({});
      return;
    case "diff":
      await diffCommand(undefined, {});
      return;
    case "validate":
      await validateCommand({});
      return;
    case "backup":
      await backupCommand({});
      return;
  }
}
```

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/actions.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/actions.ts src/tui/runtime-context.ts tests/tui/actions.test.ts
git commit -m "feat(tui): connect quick actions to internal command handlers"
```

### Task 6: Build real dashboard data loader for TUI launch

**Files:**
- Create: `src/tui/data.ts`
- Modify: `src/tui/app.ts`
- Test: `tests/tui/data.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { loadTuiFrameData } from "../../src/tui/data.js";

describe("tui data loader", () => {
  it("hydrates frame data from config defaults", async () => {
    const data = await loadTuiFrameData();
    expect(data.profile).toBeTruthy();
    expect(data.source.length).toBeGreaterThan(0);
    expect(typeof data.resourceCounts.mcps).toBe("number");
  });
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/data.test.ts`
Expected: FAIL because `loadTuiFrameData` does not exist.

**Step 3: Write minimal implementation**

```ts
export async function loadTuiFrameData(): Promise<TuiFrameData> {
  const manager = new ConfigManager();
  const config = await manager.read();
  return {
    version: getVersion(),
    profile: config.activeProfile || "default",
    source: config.source || "none",
    health: "OK",
    enabledClients: Object.values(config.clients || {}).filter((c) => c?.enabled).length,
    totalClients: Object.keys(adapters).length,
    resourceCounts: {
      mcps: Object.keys(config.resources?.mcps || {}).length,
      agents: Object.keys(config.resources?.agents || {}).length,
      skills: Object.keys(config.resources?.skills || {}).length,
    },
    driftClients: 0,
    lastSync: "unknown",
    warnings: [],
  };
}
```

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/data.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/data.ts src/tui/app.ts tests/tui/data.test.ts
git commit -m "feat(tui): load fullscreen dashboard data from config"
```

### Task 7: Add no-arg fullscreen routing with interactive fallback

**Files:**
- Create: `src/tui/entry.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`
- Test: `tests/tui/entry.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import * as app from "../../src/tui/app.js";
import * as interactive from "../../src/interactive.js";
import { startNoArgExperience } from "../../src/tui/entry.js";

describe("no-arg routing", () => {
  it("uses fullscreen TUI on interactive TTY with viewport", async () => {
    vi.spyOn(app, "runTuiApp").mockResolvedValue(undefined);
    vi.spyOn(interactive, "startInteractiveMode").mockResolvedValue(undefined as any);
    (process.stdout as any).isTTY = true;
    (process.stdin as any).isTTY = true;
    (process.stdout as any).columns = 120;
    (process.stdout as any).rows = 36;
    await startNoArgExperience();
    expect(app.runTuiApp).toHaveBeenCalled();
    expect(interactive.startInteractiveMode).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/entry.test.ts`
Expected: FAIL because entry module/logic is missing.

**Step 3: Write minimal implementation**

```ts
export async function startNoArgExperience(themeOverride?: string): Promise<void> {
  const hasTty = Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
  const hasViewport = (process.stdout.columns || 0) >= 92 && (process.stdout.rows || 0) >= 24;

  if (hasTty && hasViewport) {
    await runTuiApp({ data: await loadTuiFrameData() });
    return;
  }

  await startInteractiveMode(themeOverride);
}
```

Update `bin/synctax.ts` no-arg branch to import `../src/tui/entry.js` and call `startNoArgExperience(themeOverride)`.

**Step 4: Run test to verify GREEN**

Run: `bunx vitest run tests/tui/entry.test.ts tests/interactive.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/tui/entry.ts bin/synctax.ts src/interactive.ts tests/tui/entry.test.ts
git commit -m "feat(cli): route no-arg launch to fullscreen tui with fallback"
```

### Task 8: End-to-end TUI confirmation flow tests and final verification

**Files:**
- Modify: `tests/tui/app.test.ts`
- Modify: `tests/tui/frame.test.ts`
- Modify: `examples/fullscreen-tui.ts`
- Modify: `docs/roadmap/phase-2-premium-cli.md`

**Step 1: Write the failing test**

```ts
it("goes 1 -> confirm -> enter -> running -> result", async () => {
  const state0 = createInitialTuiState();
  const s1 = reduceTuiKey(state0, "1").state;
  expect(s1.mode).toBe("confirm");
  const s2 = reduceTuiKey(s1, "\r");
  expect(s2.effect).toBe("run-pending-action");
});
```

**Step 2: Run test to verify RED**

Run: `bunx vitest run tests/tui/app.test.ts tests/tui/frame.test.ts`
Expected: FAIL until enter-confirm effect and result-state rendering are complete.

**Step 3: Write minimal implementation**

```ts
if ((key === "\r" || key === "y") && state.mode === "confirm" && state.pendingAction) {
  return {
    state: { ...state, mode: "running", statusLine: `Running ${state.pendingAction.label}...` },
    effect: "run-pending-action",
  };
}
```

Also update the example to reflect confirmed action flow and update roadmap notes for fullscreen default + confirmation UX.

**Step 4: Run full verification (GREEN)**

Run:
- `bun run typecheck`
- `bun run lint`
- `bun run test`

Expected: all pass.

**Step 5: Commit**

```bash
git add tests/tui/app.test.ts tests/tui/frame.test.ts examples/fullscreen-tui.ts docs/roadmap/phase-2-premium-cli.md
git commit -m "test(tui): cover confirm-run flow and document fullscreen launch behavior"
```
