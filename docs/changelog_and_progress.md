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
| 2 | Premium CLI | Planned | — | [phase-2-premium-cli.md](roadmap/phase-2-premium-cli.md) |
| 3 | Core Features | Planned | — | [phase-3-core-features.md](roadmap/phase-3-core-features.md) |
| 4 | Env Vault | Planned | — | [phase-4-env-vault.md](roadmap/phase-4-env-vault.md) |
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

## 5. Next Up

### Phase 1.5b: Claude Adapter Rewrite (CRITICAL)
- Fix MCP location (.mcp.json + ~/.claude.json)
- Fix permissions (Tool(specifier) syntax)
- Fix model field, remove customInstructions
- Expand frontmatter parser (14 agent fields, 11 skill fields)
- Add scope support (user + project + local)

### Phase 1.5c-g: Remaining Adapters
- OpenCode: MCP array format, agent singular key, file-based skills
- Antigravity: config path, file-based agents/skills, memory file
- Copilot CLI: complete rewrite (paths, MCPs, agents, skills)
- Cursor: SKILL.md support, fix commands format
- Copilot VS Code: remote MCPs, agents, skills

### Phase 2: Premium CLI (Parallel Track)
- Brand header + timing on every command
- Spinners for async operations
- Per-command output redesign (tabular format)
- Command consolidation (list+info → status)

### Phase 3: Core Features (After 1.5)
- `synctax diff [client]` — preview changes
- `synctax validate` — config integrity check
- Backup + rollback on sync failure
- `synctax link` / `synctax unlink` — symlink instruction files
- `synctax doctor --deep` — MCP health checking
- `synctax add mcp --from <url>` — import from URL
