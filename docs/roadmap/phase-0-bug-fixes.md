# Phase 0: Bug Fixes

**Status**: DONE
**Effort**: ~1.5 hours
**Tests added**: 10

## Overview

Three user-facing bugs fixed before any new features were added.

## Bug 1: Interactive Escape/Exit Handling

**Problem**: Pressing Ctrl+C during a sub-prompt in interactive mode (e.g., `checkbox` when selecting resources for `sync --interactive`) threw an unhandled `ExitPromptError`. The Escape key did nothing (by design in @inquirer/prompts v8 — it types into the search field).

**Root cause**: `bin/synctax.ts` caught `ExitPromptError` at the top level, but `src/interactive.ts` had no try/catch around its switch statement. Sub-prompts (`select()`, `checkbox()`, `input()`) inside switch cases propagated errors unhandled.

**Fix**:
- Added `isPromptCancellation()` helper to `src/interactive.ts` that checks for `ExitPromptError`, `CancelPromptError`, and `AbortPromptError`
- Wrapped the initial `search()` call and the entire `switch` body in separate try/catch blocks
- Both catch blocks log `"Cancelled."` and return gracefully
- Broadened `bin/synctax.ts` catch to handle all three error types

**Files modified**: `src/interactive.ts`, `bin/synctax.ts`
**Tests added**: 3 in `tests/interactive.test.ts`

## Bug 2: Memory-Sync Silent Failure

**Problem**: `memorySyncCommand` logged a red error and returned void when the source memory file was missing. Exit code was 0 (success). Scripts/CI couldn't detect the failure. No summary of what succeeded or failed.

**Fix**:
- Set `process.exitCode = 1` when source file is missing or any target write fails
- Added `succeeded`/`failed` counters tracking per-target results
- Print summary after the loop: `"✓ Memory sync complete: N target(s) updated"` or `"⚠ Memory sync: N succeeded, M failed"`

**Files modified**: `src/commands.ts` (now `src/commands/sync.ts`)
**Tests added**: 2 in `tests/sanity_checks.test.ts`

## Bug 3: Backup File Accumulation

**Problem**: `ConfigManager.backup()` created timestamped `.bak` files on every sync and import, forever. No cleanup. The `~/.synctax/` directory could accumulate thousands of files over months of use.

**Fix**:
- Added `pruneBackups(maxBackups = 10)` method to `ConfigManager`
- Lists `.bak` files, sorts reverse-chronologically, deletes any beyond the limit
- Called automatically at the end of `backup()`
- Deletion is idempotent (catches individual ENOENT errors)

**Files modified**: `src/config.ts`
**Tests added**: 5 in `tests/config.test.ts`

## Verification

All 82 tests passed after Phase 0 (72 original + 10 new).
