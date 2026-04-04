# TypeScript Strictness Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all current `bunx tsc --noEmit` errors on branch `test-spec` without weakening type safety, while preserving runtime behavior and adding regression coverage where behavior changes.

**Architecture:** Fix the error classes in deterministic batches: import hygiene, schema/type completeness, strict null safety in source, strict null safety in tests, and residual cleanup. Keep runtime behavior stable by preferring typing-accurate helpers, explicit guards, and schema-consistent defaults. Validate each batch with focused test runs plus a full type-check before commit.

**Tech Stack:** Bun, TypeScript strict mode (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Vitest, Zod v4, Commander.js.

---

## Baseline (captured 2026-03-26)

- `git status --short`: clean working tree
- `bunx tsc --noEmit --pretty false`: **327 errors**

### Baseline Error Taxonomy

1. **Type-only import hygiene (`TS1484`)**
   - 22 errors
   - Clusters: `src/adapters/cline.ts`, `src/adapters/gemini-cli.ts`, `src/adapters/index.ts`, `src/commands/init.ts`, `src/config.ts`

2. **Schema/default completeness + typed object shape mismatches (`TS2769`, `TS2352`, part of `TS2322/TS2739/TS2740/TS2741`)**
   - 34 errors (aggregate class)
   - Clusters: `src/types.ts`, `src/commands/init.ts`, `src/commands/pull.ts`, `tests/config.test.ts`, `tests/commands.test.ts`, `tests/agents.test.ts`, `tests/adapters.test.ts`, `tests/scopes.test.ts`

3. **Strict undefined access in source (`TS2532`, `TS2322`, `TS2345`)**
   - 11 errors
   - Clusters: `src/adapters/cline.ts`, `src/adapters/gemini-cli.ts`, `src/adapters/github-copilot.ts`, `src/commands/init.ts`, `src/commands/pull.ts`

4. **Strict undefined access in tests (`TS18048`, `TS2532`)**
   - 266 errors
   - Clusters: `tests/opencode-v2.test.ts`, `tests/adapters.test.ts`, `tests/copilot-vscode-v2.test.ts`, `tests/antigravity-v2.test.ts`, `tests/cursor-v2.test.ts`, `tests/copilot-cli-v2.test.ts`, `tests/commands.test.ts`, others

5. **Mock typing incompatibility (`TS2741`)**
   - 7 errors
   - Cluster: `tests/commands.test.ts` (`global.fetch` assignment under Bun typing)

---

## Batch Order and Execution

### Task 1: Batch 1 — Type-Only Import Hygiene

**Files:**
- Modify: `src/adapters/cline.ts`
- Modify: `src/adapters/gemini-cli.ts`
- Modify: `src/adapters/index.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/config.ts`

**Step 1: Convert mixed imports to type-only imports**

Use `import type` for type symbols under `verbatimModuleSyntax`.

**Step 2: Run type-check for this class**

Run: `bunx tsc --noEmit`
Expected: `TS1484` eliminated.

**Step 3: Commit checkpoint**

```bash
git add src/adapters/cline.ts src/adapters/gemini-cli.ts src/adapters/index.ts src/commands/init.ts src/config.ts
git commit -m "chore(ts): enforce type-only imports for strict module syntax"
```

---

### Task 2: Batch 2 — Schema/Type Completeness Mismatches

**Files:**
- Modify: `src/types.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/commands/pull.ts`
- Modify: `tests/config.test.ts`
- Modify: `tests/commands.test.ts`
- Modify: `tests/agents.test.ts`
- Modify: `tests/adapters.test.ts`
- Modify: `tests/scopes.test.ts`

**Step 1: Fix schema defaults with explicit complete default objects**

Ensure `PermissionsSchema.default(...)` and `resources.default(...)` provide fully typed default values.

**Step 2: Align command object construction with required config shapes**

Replace partial `resources` objects with complete shape or typed helper factories.

**Step 3: Fix typed test fixtures to satisfy adapter/config contracts**

Provide required `skills` / `permissions` / related required fields where omitted.

**Step 4: Verify targeted suites**

Run: `bunx vitest run tests/config.test.ts tests/commands.test.ts tests/agents.test.ts tests/scopes.test.ts -v`
Expected: PASS.

**Step 5: Verify type-check**

Run: `bunx tsc --noEmit`

**Step 6: Commit checkpoint**

```bash
git add src/types.ts src/commands/init.ts src/commands/pull.ts tests/config.test.ts tests/commands.test.ts tests/agents.test.ts tests/adapters.test.ts tests/scopes.test.ts
git commit -m "fix(types): align config schema defaults and resource shape completeness"
```

---

### Task 3: Batch 3 — Strict Undefined Access in Source

**Files:**
- Modify: `src/adapters/cline.ts`
- Modify: `src/adapters/gemini-cli.ts`
- Modify: `src/adapters/github-copilot.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/commands/pull.ts`

**Step 1: Add explicit guards for indexed/candidate access**

Address `noUncheckedIndexedAccess` with deterministic fallbacks and guard branches.

**Step 2: Tighten scope typing compatibility in Copilot adapter**

Use `ConfigScope`-compatible narrowing or shared scope conversion before calling helper functions that accept narrower scope types.

**Step 3: Verify focused behavior suites**

Run: `bunx vitest run tests/adapters.test.ts tests/new_adapters.test.ts -v`

**Step 4: Verify type-check**

Run: `bunx tsc --noEmit`

**Step 5: Commit checkpoint**

```bash
git add src/adapters/cline.ts src/adapters/gemini-cli.ts src/adapters/github-copilot.ts src/commands/init.ts src/commands/pull.ts
git commit -m "fix(strict): remove undefined index access in source adapters and commands"
```

---

### Task 4: Batch 4 — Strict Undefined Access in Tests + Fetch Mock Typing

**Files:**
- Modify: `tests/adapters.test.ts`
- Modify: `tests/agents.test.ts`
- Modify: `tests/antigravity-v2.test.ts`
- Modify: `tests/commands.test.ts`
- Modify: `tests/copilot-cli-v2.test.ts`
- Modify: `tests/copilot-vscode-v2.test.ts`
- Modify: `tests/cursor-v2.test.ts`
- Modify: `tests/new_adapters.test.ts`
- Modify: `tests/opencode-v2.test.ts`
- Modify: `tests/sanity_checks.test.ts`
- Modify: `tests/skills.test.ts`
- Create: `tests/test-helpers.ts`

**Step 1: Add typed assertion helpers for indexed map access**

Create test helper(s) that narrow `T | undefined` to `T` via runtime checks.

**Step 2: Replace unsafe direct indexed access in tests**

Use helper-narrowed locals before property assertions.

**Step 3: Fix `global.fetch` mock typing**

Use `vi.spyOn(globalThis, "fetch")` with typed restoration instead of assigning mock instances directly to `global.fetch`.

**Step 4: Verify impacted test clusters**

Run:
- `bunx vitest run tests/adapters.test.ts tests/agents.test.ts tests/skills.test.ts -v`
- `bunx vitest run tests/opencode-v2.test.ts tests/cursor-v2.test.ts tests/copilot-vscode-v2.test.ts tests/copilot-cli-v2.test.ts tests/antigravity-v2.test.ts -v`
- `bunx vitest run tests/commands.test.ts tests/new_adapters.test.ts tests/sanity_checks.test.ts -v`

**Step 5: Verify type-check**

Run: `bunx tsc --noEmit`

**Step 6: Commit checkpoint**

```bash
git add tests/test-helpers.ts tests/adapters.test.ts tests/agents.test.ts tests/antigravity-v2.test.ts tests/commands.test.ts tests/copilot-cli-v2.test.ts tests/copilot-vscode-v2.test.ts tests/cursor-v2.test.ts tests/new_adapters.test.ts tests/opencode-v2.test.ts tests/sanity_checks.test.ts tests/skills.test.ts
git commit -m "test(strict): harden indexed access and fetch mocks under noUncheckedIndexedAccess"
```

---

### Task 5: Batch 5 — Residual Cleanup

**Files:**
- Modify: only files with residual diagnostics from fresh `tsc`

**Step 1: Run full type-check and fix leftovers**

Run: `bunx tsc --noEmit`

**Step 2: Run full test suite**

Run: `bun run test`

**Step 3: Commit checkpoint**

```bash
git add <residual files>
git commit -m "chore(ts): complete strictness remediation cleanup"
```

---

### Task 6: Mandatory End-to-End Verification (fresh)

Run all of:

1. `bunx vitest run tests/interactive.test.ts -v`
2. `bunx vitest run tests/commands.test.ts tests/profiles.test.ts -v`
3. `bunx vitest run tests/integration/e2e.test.ts -v`
4. `bunx vitest run tests/env-vault.test.ts tests/backup.test.ts -v`
5. `bun run test`
6. `bunx tsc --noEmit`

Capture command outputs and timestamps in remediation report.

---

### Task 7: Adversarial Review + Senior Review

**Step 1: Run bug-hunt-review on final diff**

Implement all critical/high validated findings.

**Step 2: Run code-review-expert on final diff**

Implement justified fixes (at least all P0/P1).

**Step 3: Re-run full verification matrix after review-driven changes**

Use same commands as Task 6.

---

### Task 8: Documentation + Final Report

**Files:**
- Modify: `docs/changelog_and_progress.md`
- Modify: `docs/roadmap/README.md`
- Modify: `docs/roadmap/phase-4-env-vault.md`
- Create: `docs/plans/2026-03-26-ts-strictness-remediation-report.md`

**Step 1: Update roadmap/progress docs with strictness remediation status**

Include counts before/after and verification status.

**Step 2: Write remediation report**

Required sections:
- baseline error counts by category
- fix strategy and rationale
- per-batch commit log
- review findings + resolutions
- final verification matrix (command, result, timestamp)
- remaining risks/follow-ups

**Step 3: Commit checkpoint**

```bash
git add docs/changelog_and_progress.md docs/roadmap/README.md docs/roadmap/phase-4-env-vault.md docs/plans/2026-03-26-ts-strictness-remediation-report.md
git commit -m "docs: record strict TypeScript remediation progress and verification evidence"
```

---

## Definition of Done

1. `bunx tsc --noEmit` reports zero errors.
2. All required verification commands pass on fresh runs.
3. Behavior remains stable; any behavior changes are backed by RED→GREEN tests.
4. Bug-hunt and senior review findings are documented and critical/high issues resolved.
5. Documentation is updated with auditable technical detail and final status.
