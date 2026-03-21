---
title: Synctax AI Agent Instructions
description: Crucial instructions for any AI assistant operating, refactoring, or contributing to the Synctax repository.
contents:
  - Repository Navigation: How to find essential code, tests, and documentation.
  - Critical Constraints: Hard rules regarding testing (TDD), mocking paths, and environmental quirks.
  - Development Workflow: Expected steps before pushing changes or resolving PRs.
glossary:
  - TDD: Test-Driven Development; writing failing tests in 'tests/' before implementing logic.
  - SYNCTAX_HOME: The environment variable used to safely mock the developer's home directory during test runs.
  - Red-Green Cycle: The process of verifying a test fails (Red) before writing code to make it pass (Green).
  - Chokidar v5+: The ESM-only file watching daemon library used by Synctax.
---

# Synctax AI Agent Instructions

If you are an AI assistant (like Cursor, Claude Code, Cline, etc.) operating within this repository, you **must** adhere strictly to the rules and constraints defined in this document.

## 1. Repository Navigation & Context Fetching

- **Entry Points:** The CLI entry point is `index.ts`. Core logic resides in `src/`.
- **Adapters:** Client-specific parsing and formatting logic is entirely contained within `src/adapters/` (e.g., `claude.ts`, `cursor.ts`). When adding or modifying how Synctax handles a specific AI IDE, this is the first place you should look.
- **Master Config:** The schemas dictating what Synctax tracks are defined using Zod in `src/types.ts`.
- **Tests:** The `tests/` directory contains 49+ Vitest suites. This is where you should always begin your work.

### How to fetch context:
- Read `src/types.ts` to understand the domain models (`McpServer`, `Agent`, `Skill`, etc.).
- Read `docs/architecture.md` to understand *why* and *how* each client adapter is built.
- Check `docs/changelog_and_progress.md` to understand what features have been recently completed (like the v1.5 Watch Daemon).

## 2. Critical Constraints ("Gotchas")

### 2.1 Filesystem Sandboxing (NEVER MUTATE REAL CONFIGS)
- You must **NEVER** hardcode or directly mutate `os.homedir()` or `process.cwd()` in tests. Doing so will destroy the physical user's actual IDE configurations.
- All adapters route through `process.env.SYNCTAX_HOME || os.homedir()`.
- **Rule:** In `beforeEach` test blocks, you must set `SYNCTAX_HOME` to an ephemeral `os.tmpdir()` and clean it up in `afterEach`.

### 2.2 Zod Safeties
- When modifying Zod schemas or mapping resources, heavily utilize `.default({})` and `.optional()`.
- The CLI must not crash with `undefined reference` errors during `Object.entries()` loops.

### 2.3 Chokidar ESM Quirks
- The `watch` daemon uses `chokidar` v5+, which is an **ESM-only** module.
- **Do not** attempt to dynamically mock it in Vitest via standard CommonJS `require` or top-level `vi.spyOn`. This will crash with `TypeError: Module namespace is not configurable`.
- The daemon relies on dynamic imports (`await import("chokidar")`). Test functional invocation outputs instead of deep-mocking methods, and ensure watcher instances are returned and gracefully closed in tests.

### 2.4 Script Artifacts
- If you generate temporary `.js` or `.mjs` files to run Node scripts or execute `sed` replacements (to bypass regex escaping issues), **you must delete them** before completing your task. Do not commit temporary script artifacts.

## 3. Development Workflow

1. **Plan & Understand:** Read the existing `tests/` and Zod schemas before touching `src/`.
2. **Red (Fail):** Write a failing Vitest test for the new feature or bug fix.
3. **Green (Pass):** Implement the application logic in `src/` to make the test pass. Verify using `bun run test`.
4. **Sanity Check:** Before resolving PR comments, verify the validity of the reported issue using a TDD approach (sanity check tests). Do not blindly apply automated PR comments (e.g., from Copilot) without verifying them first.

**Merge-Conservative Approach:** Security and stability are paramount. When modifying network config syncs or permission syncs, remember that restrictive deny-lists always override permissive allow-lists.

By following these instructions, you ensure the continued stability of the Synctax ecosystem.
