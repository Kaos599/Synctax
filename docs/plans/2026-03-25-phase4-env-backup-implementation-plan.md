# Phase 4 Env Vault + Native Backup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver interactive CLI loop bug fixes first, then implement Phase 4 native backup MVP with bundled zip UX, client selection, configurable output, and Env Vault scaffolding.

**Architecture:** Use strict TDD cycles for each task. Add a backup service layer for path discovery and archive generation, wire a new `backup` command into CLI/interactive flows, and introduce an Env Vault service for profile env resolution at sync time.

**Tech Stack:** Bun, TypeScript ESM, Commander.js, Vitest, `@inquirer/prompts`, `fflate`, Node/Bun crypto/fs APIs.

---

### Task 1: Interactive Loop Regression Tests (RED)

**Files:**
- Modify: `tests/interactive.test.ts`

**Step 1: Write failing tests for loop + escape behavior**

Add tests that assert:

1. Running one command returns to command search and allows a second command execution.
2. Escape from top-level search exits cleanly.
3. Escape from sub-prompt exits cleanly without unhandled throw.

**Step 2: Run test to verify failure**

Run: `bunx vitest run tests/interactive.test.ts -v`

Expected: FAIL on loop behavior.

**Step 3: Commit tests (optional checkpoint)**

```bash
git add tests/interactive.test.ts
git commit -m "test: add interactive loop and escape regression coverage"
```

---

### Task 2: Interactive Loop Fix (GREEN)

**Files:**
- Modify: `src/interactive.ts`
- Verify: `bin/synctax.ts`

**Step 1: Implement menu loop with cancellation-safe exits**

Update `startInteractiveMode` to run command selection in a loop and return only on prompt cancellation.

**Step 2: Keep prompt cancellation deterministic**

Use existing `isPromptCancellation` behavior in both top-level search and nested command execution block.

**Step 3: Run focused tests**

Run: `bunx vitest run tests/interactive.test.ts -v`

Expected: PASS.

**Step 4: Run nearby regression suites**

Run: `bunx vitest run tests/commands.test.ts tests/profiles.test.ts -v`

Expected: PASS.

---

### Task 3: Backup Command Contract Tests (RED)

**Files:**
- Create: `tests/backup.test.ts`
- Modify: `tests/commands.test.ts`

**Step 1: Add failing backup behavior tests**

Cover:

1. `synctax backup` default creates one bundled zip.
2. `--client` single selection only includes one client folder.
3. repeated `--client` values include multiple client folders.
4. `--output` controls destination path.
5. missing/unreadable files produce warnings and partial status.

**Step 2: Run tests to confirm RED**

Run: `bunx vitest run tests/backup.test.ts tests/commands.test.ts -v`

Expected: FAIL (command not implemented).

---

### Task 4: Add Backup Types + Discovery Skeleton (GREEN)

**Files:**
- Create: `src/backup/types.ts`
- Create: `src/backup/discovery.ts`
- Modify: `src/platform-paths.ts`

**Step 1: Implement backup type contracts**

Add strongly typed records for candidates, resolved entries, per-client result summaries, and run-level outcome.

**Step 2: Implement adapter-aware discovery skeleton**

Add discovery logic that gathers candidate files/directories by adapter, marks existence/readability, and labels scope/kind.

**Step 3: Add deterministic ordering helper**

Sort by scope rank then path for reproducible archive lists.

**Step 4: Run tests**

Run: `bunx vitest run tests/backup.test.ts -v`

Expected: still partially failing until archive + command wiring lands.

---

### Task 5: Bundle Archive Builder (GREEN)

**Files:**
- Create: `src/backup/archive.ts`
- Modify: `package.json`

**Step 1: Add zip dependency**

Add `fflate` dependency.

**Step 2: Implement bundle zip creation**

Create archive with layout:

- `manifest.json`
- `clients/<id>/manifest.json`
- `clients/<id>/files/<scope>/...`

Compute SHA256 per included file and include deterministic manifest ordering.

**Step 3: Handle warnings and partial status**

Unreadable/missing files are logged as warnings and reflected in manifests/results.

**Step 4: Run tests**

Run: `bunx vitest run tests/backup.test.ts -v`

Expected: core archive tests PASS.

---

### Task 6: Backup Command Wiring + Selection UX (GREEN)

**Files:**
- Create: `src/commands/backup.ts`
- Modify: `src/commands/index.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`

**Step 1: Implement command behavior**

Support:

- default all enabled clients
- `--client` repeatable
- `--interactive` multi-select
- `--layout bundle|per-client` (default bundle)
- `--output`
- `--rollup`

**Step 2: Wire CLI command**

Add new command registration and options in `bin/synctax.ts`.

**Step 3: Wire interactive command palette**

Add backup option in `src/interactive.ts` and interactive flow for client selection when needed.

**Step 4: Run command + integration tests**

Run: `bunx vitest run tests/backup.test.ts tests/commands.test.ts tests/interactive.test.ts -v`

Expected: PASS.

---

### Task 7: Per-Client Layout + Rollup Artifact (GREEN)

**Files:**
- Modify: `src/backup/archive.ts`
- Modify: `src/commands/backup.ts`
- Modify: `tests/backup.test.ts`

**Step 1: Implement per-client layout mode**

When `--layout per-client`, produce one zip per selected client.

**Step 2: Implement rollup artifact generation**

Generate additional rollup manifest artifact describing created backup outputs and checksums.

**Step 3: Add tests for both modes**

Validate output files and manifest status fields for bundle + per-client + rollup combinations.

**Step 4: Run tests**

Run: `bunx vitest run tests/backup.test.ts -v`

Expected: PASS.

---

### Task 8: Env Vault Scaffold Tests (RED)

**Files:**
- Create: `tests/env-vault.test.ts`
- Modify: `tests/profiles.test.ts`
- Modify: `tests/commands.test.ts`

**Step 1: Add failing Env Vault tests**

Cover:

1. profile `.env` file creation behavior.
2. `$VAR` resolution from profile env then `process.env`.
3. unresolved vars stay symbolic with warnings.

**Step 2: Run tests to confirm RED**

Run: `bunx vitest run tests/env-vault.test.ts tests/profiles.test.ts tests/commands.test.ts -v`

Expected: FAIL (service not implemented).

---

### Task 9: Env Vault Scaffold Implementation (GREEN)

**Files:**
- Create: `src/env-vault.ts`
- Modify: `src/commands/sync.ts`
- Modify: `src/commands/profile.ts`

**Step 1: Implement `EnvVault` service**

Methods:

- `ensureProfileEnv(profileName)`
- `loadProfileEnv(profileName)`
- `resolveEnvValue(value, profileVars)`

**Step 2: Integrate sync-time env resolution**

Resolve MCP env values before `adapter.write` in `syncCommand`.

**Step 3: Integrate profile env lifecycle hook**

Ensure profile env file exists during profile create/use flows.

**Step 4: Run tests**

Run: `bunx vitest run tests/env-vault.test.ts tests/profiles.test.ts tests/commands.test.ts -v`

Expected: PASS.

---

### Task 10: Docs + Verification

**Files:**
- Modify: `docs/roadmap/phase-4-env-vault.md`
- Modify: `docs/roadmap/README.md`
- Modify: `docs/changelog_and_progress.md`

**Step 1: Update command documentation**

Document backup defaults, client selection modes, bundle/per-client layouts, and distinction from export/import.

**Step 2: Run required verification commands**

Run in order:

1. `bunx vitest run tests/interactive.test.ts -v`
2. `bunx vitest run tests/commands.test.ts tests/profiles.test.ts -v`
3. `bun run test`
4. `bunx tsc --noEmit`

**Step 3: Record failures clearly**

If type-check fails, separate pre-existing failures from newly introduced failures.

---

## Definition of Done

1. Interactive mode loops after command execution.
2. Escape at top-level and nested prompts exits cleanly and deterministically.
3. `synctax backup` defaults to one bundled zip for selected clients.
4. Single and multi-client selection works.
5. Output destination is configurable.
6. Bundle archive contains per-client folders and manifests.
7. Warnings/partial status are reported for missing/unreadable paths.
8. Env Vault scaffold resolves profile env refs during sync.
9. Required verification commands complete with clearly reported status.
