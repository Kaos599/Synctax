# Code Quality Baseline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a fast, enforceable baseline for code quality, type safety, linting, conventions, and rules that developers can run locally and in CI.

**Architecture:** Add lightweight quality gates as scripts (`typecheck`, `lint`, `check`), introduce a minimal lint configuration tuned for this codebase, and document conventions/rules in `CLAUDE.md` + docs so quality expectations are explicit and auditable.

**Tech Stack:** Bun, TypeScript strict mode, ESLint + `@typescript-eslint`, Vitest.

---

### Task 1: Define baseline gates and commands

**Files:**
- Modify: `package.json`
- Create: `docs/qa/2026-03-26-quality-baseline-checklist.md`

**Step 1: Add scripts**

Add:
- `typecheck`: `bunx tsc --noEmit`
- `lint`: `bunx eslint . --ext .ts`
- `lint:fix`: `bunx eslint . --ext .ts --fix`
- `check`: `bun run typecheck && bun run lint && bun run test`

**Step 2: Document quick-run checklist**

Document local verification sequence and expected clean output.

**Step 3: Verify commands resolve**

Run:
- `bun run typecheck`
- `bun run lint`

Expected: command wiring valid (errors from code are acceptable until strictness remediation is complete).

---

### Task 2: Add lint configuration with practical, strict-enough rules

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`

**Step 1: Add lint dependencies**

Add dev dependencies:
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`

**Step 2: Create baseline ESLint config**

Rules target quick wins:
- no unused vars (allow `_` prefix)
- no explicit `any` (warn initially)
- no floating promises (error)
- consistent type imports (error)
- no non-null assertion (warn initially)

Keep rule set compact and aligned with current code shape.

**Step 3: Run lint and fix immediate config/runtime issues**

Run:
- `bun run lint`

---

### Task 3: Document coding conventions and code rules

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/conventions/code-quality-baseline.md`

**Step 1: Add quality gates section to `CLAUDE.md`**

Include mandatory pre-merge checks:
- `bun run typecheck`
- `bun run lint`
- `bun run test`

**Step 2: Add conventions doc**

Capture:
- Type safety expectations (no broad `as any`, narrow unknowns)
- Linting expectations (fix or justify)
- Test conventions (sandboxing, deterministic assertions)
- Adapter/command conventions (read-before-write, scope handling)

**Step 3: Link docs from roadmap/progress where relevant**

Reference baseline policy from progress docs once remediation is complete.

---

### Task 4: Stabilize initial lint adoption

**Files:**
- Modify: only files needed for quick lint conformance

**Step 1: Fix low-effort lint violations in touched files**

Focus on quick wins in files changed during TS remediation.

**Step 2: Keep strictness and behavior intact**

No broad suppressions; use targeted fixes.

**Step 3: Verify**

Run:
- `bun run lint`
- `bun run typecheck`
- `bun run test`

---

## Definition of Done

1. Baseline scripts exist and are documented.
2. Lint configuration is present and runnable.
3. `CLAUDE.md` explicitly defines quality gates and coding rules.
4. A dedicated conventions doc exists for maintainable team onboarding.
5. Baseline checks are verifiable with concrete commands.
