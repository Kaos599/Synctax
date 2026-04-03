# Synctax Roadmap

This directory contains detailed documentation for each phase of the Synctax v2.0 roadmap. Each phase is a self-contained document with architecture, API design, implementation details, and verification strategy.

## Phase Status

| Phase | Name | Status | Tests | Doc |
|-------|------|--------|-------|-----|
| 0 | Bug Fixes | **DONE** | +6 | [phase-0-bug-fixes.md](phase-0-bug-fixes.md) |
| 1 | Refactor + UI Layer | **DONE** | +23 | [phase-1-refactor.md](phase-1-refactor.md) |
| 1.5 | Adapter Correctness | **DONE** | +212 | [../research/clients.md](../research/clients.md) |
| 2 | Premium CLI Experience | **DONE** | +13 | [phase-2-premium-cli.md](phase-2-premium-cli.md) |
| 3 | Core Features | **IN PROGRESS** (feature-complete on branch) | +43 | [phase-3-core-features.md](phase-3-core-features.md) |
| 4 | Env Vault + Client Backup Rollups | **IN PROGRESS** (backup + env scaffold landed; quality baseline established, strict gates still blocked by warnings) | +17 | [phase-4-env-vault.md](phase-4-env-vault.md) |
| 5 | Team & Sharing | Planned | — | [phase-5-team-sharing.md](phase-5-team-sharing.md) |
| 6 | Deferred / Future | Backlog | — | [phase-6-deferred.md](phase-6-deferred.md) |

**Current test count (branch): 433 tests across 46 files, all passing.**

## What Was Done in Phase 1.5 (Adapter Correctness)

Deep research (80+ sources) revealed 5/9 adapters had broken config format assumptions. All adapters were rewritten/updated:

- **Claude Code**: MCPs moved to `.mcp.json`/`~/.claude.json`, permissions to `Tool(specifier)` syntax, 14-field agent frontmatter, directory-based SKILL.md skills
- **OpenCode**: MCP command as array, `environment` key, `agent` (singular), file-based SKILL.md skills
- **Antigravity**: Config path to `~/.gemini/antigravity/`, file-based agents/skills, memory → `GEMINI.md`
- **Copilot CLI**: Complete rewrite — `~/.copilot/` paths, MCP support, SKILL.md skills, agent files
- **Cursor**: SKILL.md support, plain markdown commands, project-scope MCPs
- **Copilot VS Code**: Remote MCP support, agent files, skill files

Full research: [docs/research/clients.md](../research/clients.md)

## What Was Done in Phase 2 (Premium CLI)

- Brand header + timing on every command
- Spinners for async operations
- Tabular sync output with aligned columns
- Interactive mode status line
- `list`/`info` deprecation → `synctax status`
- **Fullscreen TUI** (Ink-based React dashboard): 15 components, 16 color themes, command palette, source/theme selectors, tab navigation, fullscreen buffer, toast notifications, 12 quick actions

## Current Phase 3 Progress (branch snapshot)

- Added new commands: `diff`, `validate`, `link`, `unlink`
- Extended commands: `doctor --deep`, `add mcp --from <url>`
- Added sync rollback-on-failure behavior
- Added profile UX/reliability improvements used by Phase 3 work:
  - `profile list`, `profile diff`
  - profile `extends` resolver with cycle/missing checks
  - status drift comparison hardening
- Verification:
  - `bun run test` passes (377/377)
  - `bunx tsc --noEmit` passes (0 errors)

## Phase 4 Scope (updated)

- Env vault commands (`env set/list/edit/delete`) with profile-specific `.env` files.
- Native backup command distinct from export/import:
  - per-client zip backups saved in each client's own folder,
  - include user/project/local scope files where applicable,
  - optional rollup zip + manifest.

## Phase 4 Progress (current branch)

- Implemented:
  - interactive loop + cancellation behavior fix,
  - backup command with bundle/per-client layouts, client selection, rollup manifest,
  - backup discovery + archive subsystem,
  - Env Vault scaffold with sync-time MCP env resolution,
  - profile create/use env file initialization.
- Remaining:
  - Env Vault command surface (`env set/list/edit/delete`),
  - final decision and alignment on backup default destination semantics.
  - strict-readiness warning burn-down for hard-gate promotion (`lint:strict`/`check:strict` currently blocked by warnings).

## Principles

- **TDD always**: Failing test first, then implementation, then refactor.
- **Incremental delivery**: Each phase is independently shippable.
- **Backwards compat**: No consumer import changes unless absolutely necessary.
- **Tests green at every step**: Never proceed with a failing suite.
