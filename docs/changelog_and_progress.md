---
title: Synctax Changelog & Progress
description: Historical tracking of the Synctax project, detailing completed milestones and future roadmaps.
---

# Synctax Changelog & Progress

## Phase Status

| Phase | Name | Status | Tests | Doc |
|-------|------|--------|-------|-----|
| 0 | Bug Fixes | **DONE** | +6 tests | [phase-0-bug-fixes.md](roadmap/phase-0-bug-fixes.md) |
| 1 | Refactor + UI | **DONE** | +23 tests (105 total) | [phase-1-refactor.md](roadmap/phase-1-refactor.md) |
| 1.5a | Schema Expansion | **DONE** | +33 tests (138 total) | [research/clients.md](research/clients.md) |
| 1.5b | Claude Adapter Rewrite | Planned | — | [research/clients.md](research/clients.md) |
| 1.5c-g | Remaining Adapter Fixes | Planned | — | [research/clients.md](research/clients.md) |
| 1.5h | Conformance Tests | Planned | — | — |
| 2 | Premium CLI | **DONE** | +13 tests | [phase-2-premium-cli.md](roadmap/phase-2-premium-cli.md) |
| 3 | Core Features | **IN PROGRESS** (feature-complete on branch) | +43 tests (360 total) | [phase-3-core-features.md](roadmap/phase-3-core-features.md) |
| 4 | Env Vault + Client Backup Rollups | **IN PROGRESS** (backup + env scaffold landed; quality baseline rollout established) | +17 tests (377 total) | [phase-4-env-vault.md](roadmap/phase-4-env-vault.md) |
| 5 | Team & Sharing | Planned | — | [phase-5-team-sharing.md](roadmap/phase-5-team-sharing.md) |
| 6 | Deferred / Future | Backlog | — | [phase-6-deferred.md](roadmap/phase-6-deferred.md) |

---

## 1. Completed Milestones (v1.5)

### 1.1 Watch Daemon Mode (`synctax watch`)
- Background daemon using `chokidar` with 500ms debounce
- Auto-triggers `syncCommand` on master config changes

### 1.2 Terminal UI ASCII Banner & Theming
- FIGlet `rebel` theme (default), `pixel`/`synctax` wordmark, `default`, `cyber`, `green`
- `--theme` flag on any command

### 1.3 Interactive CLI Mode
- `@inquirer/search` palette when no args provided
- Dynamic hover descriptions, cascading prompts for complex commands

### 1.4 Tabular Matrix Dashboard (`synctax info`)
- `cli-table3` dashboard showing installed clients and resource counts

### 1.5 Advanced File Extension Parsing
- Claude adapter scrapes `*.md`, `*.agent`, `*.agents`, `*.claude` files

---

## 2. Completed: Phase 0 — Bug Fixes

### 2.1 Interactive Escape/Exit Handling (Bug 1)
- Added `isPromptCancellation()` helper to `src/interactive.ts`
- Two try/catch blocks: one for search palette, one for command execution
- Broadened catch in `bin/synctax.ts` to handle `ExitPromptError`, `CancelPromptError`, `AbortPromptError`
- **Files**: `src/interactive.ts`, `bin/synctax.ts`

### 2.2 Memory-Sync Silent Failure (Bug 2)
- `memorySyncCommand` now sets `process.exitCode = 1` on failure
- Tracks succeeded/failed counts, prints summary
- **Files**: `src/commands/sync.ts`

### 2.3 Backup File Accumulation (Bug 3)
- Added `pruneBackups(maxBackups = 10)` to `ConfigManager`
- Called automatically after every `backup()`
- **Files**: `src/config.ts`

---

## 3. Completed: Phase 1 — Refactor

### 3.1 Split commands.ts into 9 Modules
- `src/commands.ts` → 1-line shim: `export * from "./commands/index.js"`
- 9 focused modules: `_shared.ts`, `init.ts`, `sync.ts`, `pull.ts`, `manage.ts`, `profile.ts`, `info.ts`, `io.ts`, `index.ts`
- Zero import changes in any consumer (barrel + shim pattern)
- **Test impact**: Only `watch.test.ts` needed path update

### 3.2 UI Utility Layer
- `src/ui/colors.ts` — Semantic palette, symbols, brand colors, table header colors
- `src/ui/output.ts` — Dual API: `format.*` (returns string) + print functions (console.log)
- `src/ui/timer.ts` — `startTimer()` → `{ elapsed(), elapsedMs() }`
- `src/ui/table.ts` — `createTable()` wrapper for cli-table3
- `src/ui/spinner.ts` — Minimal TTY-aware spinner (no ora dependency)
- All 7 command modules migrated to `ui.*` (only `sync.ts` retains chalk for 1 call)

---

## 4. Completed: Phase 1.5a — Schema Expansion + Frontmatter + Scope

### 4.1 Deep Client Research
- Researched 80+ sources across Claude Code, OpenCode, Antigravity, GitHub Copilot (VS Code + CLI), Cursor
- **Major finding**: 5 of 9 adapters have broken config format assumptions
- Full research documented in `docs/research/clients.md`

### 4.2 Schema Expansion (`src/types.ts`)
All new fields are `.optional()` — zero breaking changes to existing configs.

- **McpServerSchema**: +5 fields (`url`, `headers`, `cwd`, `timeout`, `disabled`)
- **AgentSchema**: +10 fields (`disallowedTools`, `permissionMode`, `maxTurns`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `userInvocable`)
- **SkillSchema**: +9 fields (`argumentHint`, `disableModelInvocation`, `userInvocable`, `allowedTools`, `model`, `effort`, `context`, `agent`, `hooks`)
- **PermissionsSchema**: +6 fields (`allow`, `deny`, `ask`, `allowedUrls`, `deniedUrls`, `trustedFolders`)

### 4.3 Frontmatter Utility (`src/frontmatter.ts`)
- Shared `parseFrontmatter()` / `serializeFrontmatter()` using `js-yaml`
- Replaces fragile manual `split("---")` parsers
- Handles arrays, nested objects, booleans, multiline strings, Windows line endings
- Round-trip verified (serialize → parse → equal)

### 4.4 Scope System Update
- `ConfigScope` expanded from 3 to 4 levels: `global | user | project | local`
- `splitByScope()` now returns 4 buckets instead of 3
- `normalizeScope()` updated to preserve `local` (no longer folded into `project`)
- `mergePermissions()` updated to handle v2 fields (allow/deny/ask, URLs, trusted folders)

### 4.5 New Dependency
- `js-yaml@4.1.1` + `@types/js-yaml@4.0.9` for robust YAML frontmatter parsing

### 4.6 Tests Added
- `tests/frontmatter.test.ts` — 16 tests (parse, serialize, round-trip, edge cases)
- `tests/scopes.test.ts` — 9 tests (4-bucket split, scope mapping, null handling)
- `tests/schema-expansion.test.ts` — 8 tests (backward compat, v2 fields, full config)
- **Test total**: 138 tests across 24 files, all passing

### 4.7 Decisions Locked In
| Decision | Choice |
|----------|--------|
| Adapter fix priority | Fix adapters first (Phase 1.5 before Phase 3) |
| YAML parser | Add `js-yaml` dependency |
| Command consolidation | Consolidate `list`+`info`+`status` → single `synctax status` |
| Scope flag | `--scope <name>` replacing `--to-global`/`--to-local` |

---

## 5. Completed: Phase 1.5b — Claude Adapter Rewrite

- MCPs: `.mcp.json` (project) + `~/.claude.json` (user), NOT `settings.json`
- Permissions: `permissions.allow/deny/ask` with `Tool(specifier)` syntax
- Model: `model` field (not `preferredModel`), removed `customInstructions`
- Agent frontmatter: 14 fields via js-yaml (tools, disallowedTools, permissionMode, maxTurns, etc.)
- Skill format: directory-based `skills/<name>/SKILL.md` + legacy flat file compat
- Scope support: user + project + local
- **Files**: `src/adapters/claude.ts` (rewritten), `tests/adapters.test.ts` (updated)

---

## 6. Completed: Phase 1.5c-g — All Remaining Adapter Fixes

### OpenCode (`src/adapters/opencode.ts`)
- MCP `command` → array format, `env` → `environment`, `type: "local"/"remote"`
- Agent key → `agent` (singular), field → `prompt` (not `system_message`)
- Skills → file-based SKILL.md in `.opencode/skills/`
- **Tests**: `tests/opencode-v2.test.ts` (34 tests)

### Antigravity (`src/adapters/antigravity.ts`)
- Config path → `~/.gemini/antigravity/mcp_config.json`
- Agents → file-based (GEMINI.md, `.agent/rules/*.md`)
- Skills → file-based SKILL.md in `.agents/skills/`
- Memory → `GEMINI.md` (was `.antigravityrules`)
- **Tests**: `tests/antigravity-v2.test.ts` (34 tests)

### GitHub Copilot CLI (`src/adapters/github-copilot-cli.ts`)
- Config path → `~/.copilot/` (was `~/.config/github-copilot-cli/`)
- Skills → SKILL.md (was `aliases`)
- MCPs → `~/.copilot/mcp-config.json` (new)
- Agents → `~/.copilot/agents/` and `.github/agents/` (new)
- Permissions → `allowed_urls`/`denied_urls`/`trusted_folders`
- **Tests**: `tests/copilot-cli-v2.test.ts` (36 tests)

### Cursor (`src/adapters/cursor.ts`)
- Added SKILL.md support alongside existing commands
- Commands → plain markdown (no frontmatter)
- Added project-scope MCP reading
- **Tests**: `tests/cursor-v2.test.ts` (17 tests)

### GitHub Copilot VS Code (`src/adapters/github-copilot.ts`)
- Added remote MCP support (url, headers, requestInit)
- Added agent files (`.github/agents/`)
- Added skill files (`.github/skills/`)
- **Tests**: `tests/copilot-vscode-v2.test.ts` (26 tests)

---

## 7. Completed: Phase 2 — Premium CLI Experience

- **Brand header**: `○ Synctax v2.0 · Profile: work` on every command
- **Timing**: `Done in 0.3s · detail` footer on every command
- **Spinners**: Wrap async operations in sync, pull, init, doctor
- **Tabular sync output**: Aligned columns showing per-client MCP/agent/skill counts
- **Interactive polish**: Status line above search palette showing profile + resource counts
- **Command consolidation**: `list`/`info` → hidden aliases with deprecation hint to `synctax status`
- **Version**: `src/version.ts` exports `getVersion()` returning `"2.0.0"`
- **Spinner colors**: Uses semantic colors from ui/colors.ts
- **Tests**: `tests/premium-cli.test.ts` (13 tests)

**Test total at end of Phase 2: 317 tests across 30 files, all passing.**

---

## 8. In Progress: Phase 3 — Core Features + Reliability Pass (Current Branch)

### 8.1 Core features delivered
- `synctax diff [client]` with `--json`
- `synctax validate` with config/client/env/command/profile checks
- Sync snapshot + rollback on write failure
- `synctax link` / `synctax unlink` for shared instruction symlink workflow
- `synctax doctor --deep` for MCP command/env validation
- `synctax add mcp <name> --from <url>` import flow

### 8.2 Reliability hardening delivered during Phase 3 kickoff
- `status` drift checks are now normalized, capability-aware, and bidirectional
- Profile resolver now supports `extends` with cycle and missing-profile errors
- `synctax profile list` and `synctax profile diff <name>` added (plus `--json`)
- Profile pull/publish merge semantics hardened for supported resource domains

### 8.3 Test coverage and verification snapshot
- Added suites: `tests/diff.test.ts`, `tests/validate.test.ts`, `tests/sync-rollback.test.ts`, `tests/link.test.ts`, `tests/status.test.ts`, `tests/profile-resolver.test.ts`
- Expanded: `tests/commands.test.ts`, `tests/profiles.test.ts`, `tests/interactive.test.ts`
- `bun run test` currently passes: **360 tests across 36 files**
- `bunx tsc --noEmit` currently fails due to pre-existing repository-wide strict typing issues outside this Phase 3 change scope

## 9. Phase 4 Work Landed (Current Branch)

### 9.1 Interactive loop bug fix completed
- Interactive mode now loops back to command selection after command execution
- Escape/cancel exits interactive cleanly at top-level and nested prompts
- Coverage added for loop + cancellation paths in `tests/interactive.test.ts`

### 9.2 Native backup MVP delivered
- New backup subsystem:
  - `src/backup/types.ts`
  - `src/backup/discovery.ts`
  - `src/backup/archive.ts`
- New command: `src/commands/backup.ts`
- CLI + interactive wiring added:
  - `bin/synctax.ts`
  - `src/interactive.ts`
  - `src/commands/index.ts`
- New test suite: `tests/backup.test.ts`

### 9.3 Env Vault scaffold delivered
- New service: `src/env-vault.ts`
- Sync integrates profile env resolution for MCP env placeholders
- Profile create/use now ensures profile env file exists
- New tests: `tests/env-vault.test.ts`
- Expanded tests: `tests/commands.test.ts`, `tests/profiles.test.ts`

### 9.4 Verification snapshot
- `bun run test` currently passes: **377 tests across 39 files**
- `bunx tsc --noEmit` now passes with zero diagnostics after strictness remediation

### 9.5 TypeScript strictness remediation completed (2026-03-25)
- Root-cause batches completed for strict TypeScript diagnostics in source and tests
- Added shared strictness helpers:
  - `tests/test-helpers.ts` (`expectDefined`, `expectHas`, typed config/resource fixture builders)
  - `tests/test-helpers.test.ts` coverage for helper boundary behavior
- Hardened test suites for `noUncheckedIndexedAccess` and strict nullability:
  - v2 adapter suites (`opencode`, `cursor`, `copilot-vscode`, `copilot-cli`, `antigravity`)
  - core command/config/sanity/new-adapter suites
- Review-driven reliability fix:
  - guaranteed mock restoration in `tests/commands.test.ts` and `tests/sanity_checks.test.ts` via `vi.restoreAllMocks()` in `afterEach`
- Review results:
  - 4-agent adversarial bug hunt: 2 real reliability bugs confirmed and fixed
  - senior review: one medium helper hardening item accepted and implemented (`expectHas` now rejects `null`)

### 9.6 Mandatory verification matrix (2026-03-25)
- `bunx vitest run tests/interactive.test.ts -v` — PASS
- `bunx vitest run tests/commands.test.ts tests/profiles.test.ts -v` — PASS
- `bunx vitest run tests/integration/e2e.test.ts -v` — PASS
- `bunx vitest run tests/env-vault.test.ts tests/backup.test.ts -v` — PASS
- `bun run test` — PASS (377/377)
- `bunx tsc --noEmit` — PASS (0 errors)

### 9.7 Quality baseline rollout status (2026-03-26)
- Two-tier quality gates landed: permissive baseline (`typecheck`, `lint`, `test`, `check`) plus strict readiness gates (`lint:strict`, `check:strict`).
- Suppression/conventions policy is documented in `docs/conventions/code-quality-baseline.md` and rollout tracking is in `docs/qa/2026-03-26-quality-baseline-checklist.md`.
- Full verification matrix snapshot:
  - `bun run typecheck` — PASS
  - `bun run lint` — PASS with warnings (0 errors, 240 warnings)
  - `bun run lint:strict` — FAIL (`--max-warnings=0`, 0 errors, 240 warnings)
  - `bun run test` — PASS (377 tests)
  - `bun run check` — PASS (`typecheck` pass, `lint` pass with warnings, `test` pass)
  - `bun run check:strict` — FAIL (non-zero from `lint:strict` warnings)
- Strict-readiness status: not hard-gate ready; keep staged rollout until warning backlog is reduced to zero.

## 10. Next Up

- Phase 4: complete Env Vault command surface (`env set/list/edit/delete`)
- Phase 4: finalize backup default destination semantics versus current bundle-first behavior and update docs accordingly
- Complete lint warning burn-down to unlock strict hard-gate promotion (`lint:strict` and `check:strict`)
- Phase 5: team sharing and portable overlays
