# Phase 1: Refactor

**Status**: DONE
**Effort**: ~6 hours
**Tests added**: 23 (total suite now 105 tests across 21 files)

## Overview

Split the 911-line monolithic `commands.ts` into focused modules and created a reusable UI utility layer. This provides the foundation for all future feature work.

## Phase 1.1: Split commands.ts

### Before
```
src/commands.ts  — 911 lines, 20+ exported functions, all in one file
```

### After
```
src/commands.ts         — 1-line backwards-compat shim: export * from "./commands/index.js"
src/commands/
  _shared.ts            — getConfigManager(), mergePermissions(), applyProfileFilter()
  init.ts               — initCommand
  sync.ts               — syncCommand, memorySyncCommand, watchCommand
  pull.ts               — pullCommand
  manage.ts             — addCommand, removeCommand, moveCommand
  profile.ts            — profileCreateCommand, profileUseCommand, profilePullCommand, profilePublishCommand
  info.ts               — listCommand, statusCommand, doctorCommand, infoCommand
  io.ts                 — restoreCommand, exportCommand, importCommand
  index.ts              — barrel re-exports all symbols
```

### Key decisions

**Barrel + shim pattern**: `src/commands.ts` becomes `export * from "./commands/index.js"`. All existing imports (`"../src/commands.js"`, `"./commands.js"`) continue working unchanged. Zero test modifications required (except `watch.test.ts` which reads source by file path).

**Grouping rationale**:
- `sync.ts` groups syncCommand + memorySyncCommand + watchCommand because watchCommand calls syncCommand internally
- `manage.ts` groups add/remove/move because they all mutate the resource registry and optionally call syncCommand
- `profile.ts` groups all 4 profile commands; profilePullCommand calls profileUseCommand (same file)
- `info.ts` groups all read-only diagnostic/display commands

**Dependency graph (no cycles)**:
```
_shared.ts ← sync.ts ← manage.ts, profile.ts
_shared.ts ← pull.ts, info.ts, io.ts, init.ts
```

### Star import compatibility

`tests/interactive.test.ts` uses `import * as commands from "../src/commands.js"` for `vi.spyOn`. The `export *` shim preserves the module namespace — Vitest's ESM transform makes bindings mockable. Verified working.

## Phase 1.2: UI Utility Layer

### Structure
```
src/ui/
  index.ts     — public API re-exports
  colors.ts    — semantic palette (success/error/warning/info/muted/label), symbols (✓/✗/⚠/○/→/·), brand colors, table header colors
  output.ts    — dual API: format.* returns strings, print functions write to console.log
  timer.ts     — startTimer() → { elapsed(), elapsedMs() }
  table.ts     — createTable() wrapper for cli-table3 with brand colors
  spinner.ts   — minimal TTY-aware spinner (interval-based, no ora dependency)
```

### API design

**Dual API (format + print)**:
```typescript
// format.success("msg") → returns styled string (for embedding in tables, rl.question, etc.)
// success("msg")        → console.log(styled string) (drop-in replacement for chalk calls)
```

**Output options**:
```typescript
interface OutputOptions {
  indent?: number;  // multiplied by "  " (2 spaces)
  prefix?: string;  // override default symbol
}
```

**Brand header + summary** (for Phase 2 premium output):
```typescript
format.brandHeader("2.0", "work")  → "\n  ○ Synctax v2.0 · Profile: work\n"
format.summary("0.3s", "4/5 synced") → "\n  Done in 0.3s · 4/5 synced"
```

### Migration results

- 7 of 8 command modules fully migrated to `ui.*` (no chalk imports)
- 1 module (`sync.ts`) retains chalk for a single `chalk.magenta` call in watchCommand
- `src/interactive.ts` fully migrated
- All existing test spies on `console.log` continue working because print functions use `console.log` internally

### Colors reference

| Semantic | Chalk | Symbol | Usage |
|----------|-------|--------|-------|
| success | green | ✓ | Completed actions |
| error | red | ✗ | Failed actions |
| warning | yellow | ⚠ | Warnings, dry-run notices |
| info | blue | ○ | Action headers, brand |
| muted | gray | — | Secondary info, hints |
| label | cyan | — | Section headers |
| emphasis | bold | — | Key terms |
| highlight | whiteBright.bold | — | Active items in tables |

### Table header brand colors

| Column | Hex |
|--------|-----|
| col1 | #E4FF30 (electric lime) |
| col2 | #4DFFBE (mint) |
| col3 | #63C8FF (sky blue) |
| col4 | #FF2DD1 (magenta) |
| col5 | #FF0B55 (hot pink) |

## Verification

- 105 tests across 21 files, all passing
- `src/commands.ts` is 1 line
- `src/commands/` has 9 focused modules
- `src/ui/` has 6 utility files with 4 test files
- Type-check passes (`bunx tsc --noEmit` — no new errors)
