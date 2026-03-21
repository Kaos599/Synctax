---
title: Synctax Technical Context
description: Details the technology stack, testing constraints, architectural patterns, and known environment quirks for the Synctax project.
contents:
  - Technologies Used: The runtime, language, and core libraries.
  - Development Setup: Dependencies, TDD sandbox, and execution commands.
  - Technical Constraints: Filesystem mocking, Zod safeties, ESM quirks.
glossary:
  - Bun: The ultra-fast JavaScript runtime and package manager used by Synctax.
  - Vitest: The testing framework used to enforce TDD.
  - Chokidar: The file-watching library powering the 'synctax watch' daemon.
  - Zod: The TypeScript-first schema declaration and validation library.
---

# Synctax Technical Context

This document outlines the technical foundation, development setup, and critical constraints that govern the Synctax repository. It is essential reading for anyone modifying core engine logic or adding new client adapters.

## Technologies Used

- **Runtime:** Node.js 20+ executing via **Bun**
  - Bun is chosen for its native TypeScript execution speed and fast test runner capabilities.
- **Language:** TypeScript
- **Testing:** Vitest
  - We use Vitest for its speed, watch mode, and seamless integration with our ESM/TypeScript stack.
- **Validation:** Zod
  - Zod is the backbone of our `ConfigManager`, ensuring that `~/.synctax/config.json` conforms to our expected domain models (`McpServer`, `Agent`, `Skill`, `Permissions`, etc.) before any adapter attempts to parse it.
- **CLI UI:** Commander.js, Inquirer.js, Chalk, cli-table3
  - **Commander.js:** Provides robust command routing (`init`, `info`, `watch`, `sync`).
  - **Inquirer.js (@inquirer/prompts):** Powers the robust interactive command palette that automatically intercepts the default `synctax` execution when no arguments are provided.
  - **Chalk:** Enables custom hex themes (`#362F4F`, `#5B23FF`) bounding DOS Rebel ASCII art.
  - **cli-table3:** Powers the beautiful matrix dashboards seen in `synctax info`.
- **Automation:** Chokidar
  - Powers the background `synctax watch` daemon.

## Development Setup

- **Dependencies:** Installed via `bun add commander chalk zod chokidar cli-table3`.
- **Execution:** The CLI is typically run via `bun run bin/synctax` (or compiled).
- **Testing:** Run the test suite using `bun run test`. The tests execute extremely quickly.

## Technical Constraints & Patterns

### 1. Test-Driven Development (TDD)
Synctax strictly enforces a Red-Green TDD approach.
- **Red:** Every new feature, bug fix, or PR review starts by writing a failing unit test in the `tests/` directory.
- **Green:** Only after verifying the test fails do you write the application logic in `src/` to make it pass.
- **Why:** This ensures regressions are never introduced when managing sensitive files like `.cursorrules` or `.claude/settings.json`.

### 2. Filesystem Mocking (`SYNCTAX_HOME`)
- **The Danger:** If a test runs against `os.homedir()`, it will overwrite the developer's actual IDE configurations, destroying their local setup.
- **The Solution:** **ALL** absolute paths in the application logic must resolve dynamically via `process.env.SYNCTAX_HOME || os.homedir()`.
- **The Sandbox:** In test files, `beforeEach` blocks must create an ephemeral `os.tmpdir()` sandbox and map it to `process.env.SYNCTAX_HOME`. Every spec must clean up after itself in `afterEach`.

### 3. Zod Safeties
- **The Danger:** Zod schemas without `.default()` or `.optional()` can throw `undefined` reference errors during runtime operations like `Object.entries()`, causing the entire CLI to crash if a user's config is slightly malformed.
- **The Solution:** Rely heavily on `.default({})` and `.optional()` for blocks like `permissions`, `models`, and `credentials` in `src/types.ts`.

### 4. ESM Quirks (Chokidar v5+)
- **The Danger:** Chokidar v5+ is an ESM-only module without a default export. Trying to dynamically mock it in Vitest via standard CommonJS `require` or top-level `vi.spyOn` will crash the test suite with `TypeError: Module namespace is not configurable`.
- **The Solution:** The `watch` daemon relies on dynamic imports (`const chokidar = await import("chokidar");`).
- **Testing Strategy:** When testing features reliant on Chokidar, do not attempt to deep-mock its methods. Test the functional invocation output, ensure the config includes stability thresholds, and return the watcher instance so it can be gracefully closed in tests.

### 5. Cross-Platform Execution
The tool must execute perfectly handling Mac, Windows, and Linux path resolutions. Always use `path.join()`, `path.dirname()`, and related utilities from the native `path` module.

### 6. Merge-Conservative Logic (Permissions & Credentials)
- **Permissions:** Restrictive rules always take precedence. If one client allows a path but another denies it, the sync operation must favor the deny-list to maintain security.
- **Credentials:** System secrets must be stripped during `profile publish` events and maintained strictly as `$ENV_VAR` references. Raw secret values should never be saved.
