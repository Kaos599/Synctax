# Approach 1 Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Phase 1 (this-week safety fixes + all P0 findings) and Phase 2 milestone upgrades (backup architecture, watch reliability, adapter conformance pass).

**Architecture:** Apply security and reliability fixes in small TDD slices: test the broken behavior first, patch minimal code, then verify global quality gates. Prioritize trust-boundary protections and transactional safety before behavior and conformance refinements.

**Tech Stack:** Bun, TypeScript (strict), Commander, Zod, Vitest, Chokidar, fflate.

---

### Task 1: Enforce safe resource keys (P0)

**Files:**
- Create: `src/resource-name.ts`
- Modify: `src/types.ts`
- Modify: `src/adapters/claude.ts`
- Modify: `src/adapters/cursor.ts`
- Modify: `src/adapters/antigravity.ts`
- Modify: `src/adapters/opencode.ts`
- Modify: `src/adapters/github-copilot-cli.ts`
- Test: `tests/commands.test.ts`

**Step 1: Write failing tests**
- Add a test that `profilePullCommand` rejects payloads containing malicious resource keys (`../`, path separators) and does not persist them.

**Step 2: Run test to verify RED**
- Run: `bunx vitest run tests/commands.test.ts -t "malicious resource key"`
- Expected: fail because key currently merges/writes.

**Step 3: Minimal implementation**
- Add reusable key validator.
- Apply key schema validation for resource map keys in `ConfigSchema`.
- Add defensive key checks in adapters before filesystem writes using resource keys.

**Step 4: Verify GREEN**
- Re-run targeted test.

**Step 5: Commit**
- Stage files for key validation and related tests.

### Task 2: Restore transactional safety (P0)

**Files:**
- Modify: `src/commands/io.ts`
- Test: `tests/commands.test.ts`

**Step 1: Write failing tests**
- Add test: corrupted backup should not overwrite current config.
- Add test: `--from` requires exact match (timestamp or exact file name), not substring match.

**Step 2: Run test to verify RED**
- Run: `bunx vitest run tests/commands.test.ts -t "restore"`
- Expected: fail on current restore behavior.

**Step 3: Minimal implementation**
- Validate selected backup with `ConfigSchema.parse` before apply.
- Replace substring backup matching with exact matching.
- Add pre-restore snapshot and atomic temp-write + rename.
- Set non-zero exit code on restore failure.

**Step 4: Verify GREEN**
- Re-run targeted restore tests.

**Step 5: Commit**
- Stage restore and tests.

### Task 3: Non-TTY-safe interactive semantics + exit-code normalization (Phase 1)

**Files:**
- Create: `src/commands/_terminal.ts`
- Modify: `src/commands/io.ts`
- Modify: `src/commands/sync.ts`
- Modify: `src/commands/pull.ts`
- Modify: `src/commands/manage.ts`
- Modify: `src/commands/backup.ts`
- Modify: `src/commands/profile.ts`
- Modify: `src/commands/info.ts`
- Modify: `bin/synctax.ts`
- Test: `tests/commands.test.ts`
- Test: `tests/export_import.test.ts`

**Step 1: Write failing tests**
- Add non-TTY import mismatch test (must fail fast with exit code 1, no hang).
- Add tests for command error paths that should set non-zero exit.

**Step 2: Run test to verify RED**
- Run targeted tests for import/command failures.

**Step 3: Minimal implementation**
- Add reusable TTY guard for interactive-only flows.
- Apply guard across interactive flags and no-arg interactive CLI entry.
- Normalize key command failure paths to set `process.exitCode = 1`.
- Ensure `doctor` command propagates unhealthy status to CLI exit code.

**Step 4: Verify GREEN**
- Re-run targeted tests.

**Step 5: Commit**
- Stage terminal/exit-code files and tests.

### Task 4: Command semantics correctness fixes (Phase 1)

**Files:**
- Modify: `src/commands/manage.ts`
- Modify: `src/commands/pull.ts`
- Modify: `bin/synctax.ts`
- Test: `tests/commands.test.ts`

**Step 1: Write failing tests**
- `remove --interactive --dry-run` must not mutate.
- `move` must enforce exactly one of `--to-global` / `--to-local`.
- `pull --merge --overwrite` conflict must fail.
- invalid pull domain should fail clearly.

**Step 2: Run test to verify RED**
- Run targeted command tests.

**Step 3: Minimal implementation**
- Add dry-run guard in interactive remove flow.
- Add XOR validation in move.
- Add explicit pull mode conflict validation.
- Add pull domain normalization/validation and help text parity updates.

**Step 4: Verify GREEN**
- Re-run targeted command tests.

**Step 5: Commit**
- Stage command semantics fixes.

### Task 5: Backup architecture improvements (milestone)

**Files:**
- Modify: `src/backup/archive.ts`
- Modify: `src/commands/backup.ts`
- Test: `tests/backup.test.ts`

**Step 1: Write failing tests**
- Add test: repeated per-client backup does not overwrite existing artifacts.
- Add test: bundle writes artifact atomically via final valid zip path.

**Step 2: Run test to verify RED**
- Run: `bunx vitest run tests/backup.test.ts`

**Step 3: Minimal implementation**
- Add collision-safe output path resolution.
- Add atomic file write helper for zip/rollup artifacts.
- Emit archive SHA256 metadata for generated artifacts.

**Step 4: Verify GREEN**
- Re-run backup tests.

**Step 5: Commit**
- Stage backup architecture improvements.

### Task 6: Watch reliability single-flight + churn behavior (milestone)

**Files:**
- Modify: `src/commands/sync.ts`
- Modify: `tests/watch.test.ts`

**Step 1: Write failing tests**
- Add behavior test using mocked chokidar: rapid changes debounce to one sync trigger.
- Add behavior test: change during in-flight sync queues exactly one rerun.

**Step 2: Run test to verify RED**
- Run: `bunx vitest run tests/watch.test.ts`

**Step 3: Minimal implementation**
- Add single-flight guard and one-pending-rerun queue in `watchCommand`.

**Step 4: Verify GREEN**
- Re-run watch tests.

**Step 5: Commit**
- Stage watch reliability code and tests.

### Task 7: Adapter conformance pass (milestone)

**Files:**
- Modify: `src/adapters/claude.ts`
- Modify: `src/adapters/cursor.ts`
- Modify: `src/adapters/cline.ts`
- Modify: `src/adapters/github-copilot.ts`
- Modify: `src/adapters/github-copilot-cli.ts`
- Modify: `src/adapters/opencode.ts`
- Modify: `src/adapters/antigravity.ts`
- Test: `tests/adapters.test.ts`
- Test: `tests/new_adapters.test.ts`

**Step 1: Write failing tests**
- Claude transport read/write symmetry test.
- Cursor project/local scope write routing test.
- Cline user/project precedence test for explicit `false` network override.
- Copilot non-project target routing test.
- Local scope mapping tests for adapters that should route `local` to project.

**Step 2: Run test to verify RED**
- Run targeted adapter tests.

**Step 3: Minimal implementation**
- Fix each adapter behavior to satisfy contract and scope semantics.

**Step 4: Verify GREEN**
- Re-run targeted adapter tests.

**Step 5: Commit**
- Stage conformance changes.

### Task 8: Full verification and stabilization

**Files:**
- Modify (if needed from failures): affected source/test files

**Step 1: Run required gates**
- `bun run typecheck`
- `bun run lint`
- `bun run test`

**Step 2: Fix regressions minimally**
- Address any failures with additional red-green cycles.

**Step 3: Final verification rerun**
- Re-run all three gates and confirm clean output.

**Step 4: Summarize**
- Prepare completion summary with exact file refs and behavior deltas.

**Step 5: Commit**
- Create final integration commit if requested.
