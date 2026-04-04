# Terminal UX Consistency + Spinner Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Synctax output behavior consistent across TTY/non-TTY/CI and ensure spinner/progress feedback is always visible and truthful.

**Architecture:** Introduce a capability detection layer (`src/ui/capabilities.ts`) that drives color, unicode symbols, and animation behavior. Refactor spinner and symbol/color primitives to consume capabilities so command output degrades cleanly in non-interactive terminals. Fix command-level UX correctness issues where pull failures lacked non-zero exit semantics and sync completion messaging could report success on failure.

**Tech Stack:** Bun, TypeScript (strict), Vitest, Chalk, cli-table3

---

### Task 1: Add failing tests for terminal capability and spinner behavior

**Files:**
- Create: `tests/ui/spinner.test.ts`
- Create: `tests/ui/capabilities.test.ts`
- Modify: `tests/ui/colors.test.ts`

**Step 1: Write failing tests first (RED)**
- Assert spinner writes animated frames to `stderr` in interactive contexts.
- Assert spinner does not spam intermediate update lines in non-TTY mode.
- Assert symbol set falls back to ASCII when `SYNCTAX_ASCII=1`.

**Step 2: Run tests to confirm failure**
- Run: `bunx vitest run tests/ui/spinner.test.ts tests/ui/colors.test.ts`
- Expected: failures showing missing fallback and spinner lifecycle behavior.

### Task 2: Implement terminal capability detection

**Files:**
- Create: `src/ui/capabilities.ts`
- Modify: `src/ui/index.ts`

**Step 1: Add capability model**
- Add a capability object including mode (`rich|standard|plain`), TTY status, color support, unicode support, and animation support.
- Detect env flags (`CI`, `NO_COLOR`, `FORCE_COLOR`, `SYNCTAX_ASCII`, `TERM=dumb`).

**Step 2: Export capability helpers**
- Export detection APIs through `src/ui/index.ts` for reuse across UI modules and tests.

### Task 3: Refactor spinner and color/symbol rendering

**Files:**
- Modify: `src/ui/spinner.ts`
- Modify: `src/ui/colors.ts`
- Modify: `src/ui/table.ts`

**Step 1: Spinner behavior updates**
- Route transient animated writes to `stderr`.
- Animate only when capabilities allow animation.
- Use single static progress line in non-animated mode.
- Stop printing intermediate `.text()` updates in plain/non-interactive mode.

**Step 2: Symbol/color adaptation**
- Replace static symbol literals with capability-aware getters.
- Ensure colors degrade to plain text when color is disabled.
- Add adaptive brand/table color handling for low color-depth terminals.

**Step 3: Keep lint-safe access patterns**
- Avoid non-null assertions in touched UI paths.

### Task 4: Fix command-level UX correctness and theme fallback

**Files:**
- Modify: `src/commands/pull.ts`
- Modify: `src/commands/sync.ts`
- Modify: `src/config.ts`
- Modify: `tests/commands.test.ts`
- Modify: `tests/sync-rollback.test.ts`

**Step 1: Pull failure semantics**
- Set `process.exitCode = 1` when pull fails.

**Step 2: Sync completion semantics**
- Print `Sync failed` header when write flow fails.
- Keep `Sync complete!` only for successful sync runs.

**Step 3: Theme fallback consistency**
- Make `ConfigManager.getTheme()` fallback match schema default (`rebel`).

### Task 5: Validate and document

**Files:**
- Modify: `docs/roadmap/phase-2-premium-cli.md`

**Step 1: Verification**
- Run targeted tests and then full gates:
  - `bun run typecheck`
  - `bun run lint`
  - `bun run test`

**Step 2: Roadmap consistency note**
- Update Phase 2 status wording to reflect completed implementation with follow-up hardening notes.
