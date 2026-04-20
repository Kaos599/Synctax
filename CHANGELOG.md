# Changelog

All notable changes to Synctax are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **Theme defaults**: Persisted/default theme fallback is now `"synctax"` across schema/config/init/interactive/TUI loaders, and sync avoids no-op source write-backs that could materialize unintended defaults.
- **Sync observability**: Added per-phase ETA hints, per-client analyze/write/rollback timing lines, and richer finalize summaries with phase/client metrics.
- **OpenCode detection**: Expanded config and skills discovery to include `OPENCODE_CONFIG` and compatibility skill roots (`.claude/skills`, `.agents/skills`, plus global equivalents).
- **Client aliases**: Added canonicalization for common client id variants (for example `open code`/`open-code` → `opencode`) in pull/init/sync/status/doctor flows.

## [2.1.2] — 2026-04-20

### Changed

- **Version bump**: Updated CLI/package version to `2.1.2`.

## [2.0.1] — 2026-04-05

### Fixed

- **TUI data loader**: Invalid `source` in config now correctly falls back to the default adapter instead of remaining set to the invalid value, preventing downstream TUI failures
- **TUI data loader**: Theme fallback now uses `"rebel"` to match the schema default in `src/types.ts` (was `"synctax"`, causing inconsistent defaults)
- **TUI entrypoint**: `NODE_ENV` is now restored in the `finally` block after `waitUntilExit()`, ensuring it is always restored even if `render()` throws, and that it doesn't affect code running during the TUI lifetime
- **Atomic writes**: Temp file now uses a unique name (`pid-timestamp-random` suffix) instead of a deterministic `.synctax-tmp` suffix, preventing stale file collisions from crashed writes under concurrent access
- **Lock errors**: Error messages now interpolate the actual computed `lockPath` instead of hardcoding `~/.synctax/sync.lock`, which was misleading when `SYNCTAX_HOME` is set (e.g., in tests)
- **ESLint config**: `.tsx` files (Ink/React TUI components) are now covered by the ESLint config alongside `.ts` files
- **Module entry**: `index.ts` no longer emits an unconditional `console.log` side effect on import; replaced with `export {}`
- **`synctax add`**: Scope flag resolution for `agent` and `skill` now mirrors MCP: `--global` → `"global"`, `--local` → `"local"`, neither → `"global"` (was: `agent`/`skill` ignored `--local` and defaulted to `"local"`, inconsistent with MCP)

---

## [2.0.0] — 2026-04-05

### Initial Release

**Synctax** — Universal Sync for the Agentic Developer Stack.

#### Core Sync Engine
- `synctax sync` — atomic push to all enabled clients with pre-sync snapshots and rollback on failure
- `synctax pull --from <client>` — import a client's live config into master config
- `synctax watch` — background daemon that auto-syncs on `~/.synctax/config.json` save (500ms debounce)
- `synctax memory-sync` — copy source client's context/memory file to all other enabled clients
- `--dry-run`, `--yes`, `--strict-env`, `--interactive` flags on sync

#### Inspection & Diagnostics
- `synctax status` — health overview: drift state, resource counts, env var resolution
- `synctax diff [client]` — preview changes without writing; `--json` for machine-readable output
- `synctax doctor [--deep]` — diagnose missing clients, broken paths, invalid env vars; `--deep` verifies MCP binary existence
- `synctax validate` — schema validation, env var resolution, required PATH binary check

#### Config Management
- `synctax add <type> <name>` — add MCP server, agent, or skill interactively or via flags; `--from <url>` to import from URL/gist
- `synctax remove [type] [name]` — remove a resource (interactive with `-i`)
- `synctax move <type> <name>` — move resource between scopes (`--to-global`, `--to-local`, `--to-project`)

#### Profile System
- `synctax profile create <name>` — create a named resource filter profile
- `synctax profile use <name>` — switch active profile and sync immediately
- `synctax profile list` — list profiles with active marker
- `synctax profile diff <name>` — preview changes before switching profiles
- `synctax profile pull <url>` — import a profile from a URL
- `synctax profile publish <name>` — export shareable profile (credentials automatically stripped)

#### Backup & Portability
- `synctax backup [--rollup]` — per-client zip backups; `--rollup` creates a combined archive
- `synctax restore [--from <timestamp>]` — restore master config from backup
- `synctax export <file>` — export master config to JSON (credentials stripped)
- `synctax import <file>` — import master config from JSON
- `synctax link` / `synctax unlink` — symlink memory/instruction files to a single source

#### Interactive Fullscreen TUI
- `synctax` (no args) — fullscreen dashboard with live status, diagnostics, quick actions, command palette
- 16 built-in color themes: synctax, catppuccin, dracula, nord, tokyo-night, gruvbox, one-dark, solarized, rose-pine, monokai, cyberpunk, sunset, ocean, forest, ember, aurora
- Keyboard-driven: number keys for quick actions, `/` for command palette, `t` for theme switcher, `?` for help

#### 9 Supported Clients
Claude Code, Cursor, GitHub Copilot (VS Code), GitHub Copilot CLI, OpenCode, Cline, Zed, Antigravity, Gemini CLI

#### Security
- Deny-wins permission merge: deny lists always override allow lists
- Credentials never exported (stripped from all `export` / `profile publish` outputs)
- Per-profile `.env` files (0600 permissions, never synced or published)
- Path-traversal protection on all file operations
- Atomic temp-file writes with rename for crash safety

[2.0.0]: https://github.com/Kaos599/synctax/releases/tag/v2.0.0
