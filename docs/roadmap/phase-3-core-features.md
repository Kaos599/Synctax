# Phase 3: Core Features

**Status**: In Progress (feature-complete on branch)
**Estimated effort**: 15-20 hours
**Depends on**: Phase 1 (DONE), Phase 2 (recommended but not blocking)

## Implementation Status Snapshot (2026-03-25)

Implemented on the current development branch:

- `synctax diff [client]` with `--json`
- `synctax validate`
- Sync snapshot + rollback on write failure
- `synctax link` / `synctax unlink`
- `synctax doctor --deep`
- `synctax add mcp <name> --from <url>`

Related reliability/profile work delivered during Phase 3 kickoff:

- `status` drift logic hardening (normalized + capability-aware + bidirectional)
- Profile `extends` resolution with cycle/missing checks
- `synctax profile list` and `synctax profile diff <name>`
- Profile pull/publish merge symmetry hardening

Verification snapshot:

- `bun run test` passes (360 tests)
- `bunx tsc --noEmit` currently fails due to pre-existing strict TypeScript issues outside this feature scope

## Overview

Six new commands/features that address the most critical gaps in Synctax's functionality: safety (diff, backup+rollback), convenience (link, validate, add-from-url), and reliability (health checks).

## 3.1 `synctax diff [client]`

### Purpose
Preview what would change before running `sync` or `pull`. The #1 missing safety feature.

### Output format
```
$ synctax diff claude

  MCPs:
    + new-mcp          (not in master)
    ~ postgres          command: npx → bunx
    - old-mcp          (in master, not in client)

  Agents:
    ~ Coder            prompt differs (3 lines)

  Skills:
    (no changes)

  2 added, 1 modified, 1 removed
```

### Algorithm
1. Read master config via `configManager.read()`
2. Read client config via `adapter.read()`
3. For each resource category (mcps, agents, skills):
   - Items in client but not master → `+` (added)
   - Items in master but not client → `-` (removed)
   - Items in both with different values → `~` (modified, show which fields changed)
4. Color-coded: green adds, yellow changes, red removes

### Flags
- `synctax diff` (no client) — diff ALL enabled clients
- `synctax diff claude` — diff specific client
- `--json` — machine-readable JSON output

### Implementation
- New file: `src/commands/diff.ts`
- New tests: `tests/diff.test.ts`
- Register in `bin/synctax.ts` and `src/interactive.ts`
- Add to `src/commands/index.ts` barrel

### Effort: Medium (4-6 hours)
### Status: Implemented

## 3.2 `synctax validate`

### Purpose
Check config integrity without syncing. Useful before `sync` or in CI.

### Checks
1. Config parses against Zod `ConfigSchema`
2. All enabled clients are detectable on disk
3. All `$ENV_VAR` references in MCP env blocks resolve to set environment variables
4. All MCP `command` values exist on PATH (via `which`)
5. No duplicate resource names with conflicting scopes
6. Active profile exists in profiles map

### Output
```
$ synctax validate

  ✓ Config schema valid
  ✓ 5/5 enabled clients detected
  ⚠ Missing env var: $POSTGRES_URL (referenced by mcp "postgres")
  ✓ All MCP commands found on PATH
  ✓ No duplicate resources
  ✓ Active profile "work" exists

  5 passed, 1 warning
```

### Implementation
- New file: `src/commands/validate.ts`
- New tests: `tests/validate.test.ts`

### Effort: Small (2-3 hours)
### Status: Implemented

## 3.3 Backup + Rollback on Sync Failure

### Purpose
Make sync atomic: if any client write fails, roll back all already-synced clients to pre-sync state.

### Algorithm
1. Before sync: call `adapter.read()` on ALL enabled clients → save snapshots in memory
2. Attempt `adapter.write()` on each client sequentially
3. If ANY write throws:
   a. Roll back all previously-synced clients by calling `adapter.write(snapshot[clientId])`
   b. Report: "Sync failed on Cline. Rolled back Claude Code, Cursor, Zed."
4. If all succeed: report normally

### Edge cases
- Rollback itself fails → log error, don't retry (avoid infinite loop)
- Partial snapshot (read fails for one client) → skip that client in sync, warn

### Implementation
- Modify `src/commands/sync.ts` `syncCommand`
- New tests with mock adapters that fail on write

### Effort: Medium (3-4 hours)
### Status: Implemented

## 3.4 `synctax link` — Symlink Instruction Files

### Purpose
Replace copy-based `memory-sync` with zero-latency symlinks for instruction/memory files.

### Behavior
```
$ synctax link

  Creating instruction symlinks in current directory...
  Source: .synctax/instructions.md

  ✓ CLAUDE.md → .synctax/instructions.md
  ✓ .cursorrules → .synctax/instructions.md
  ✓ AGENTS.md → .synctax/instructions.md
  ✓ .rules → .synctax/instructions.md
  ✓ .clinerules → .synctax/instructions.md
  ✓ .geminirules → .synctax/instructions.md
  ✓ .github/copilot-instructions.md → .synctax/instructions.md
  ✓ .antigravityrules → .synctax/instructions.md

  8 clients linked. Edit .synctax/instructions.md to update all.
```

### How it works
1. If `.synctax/instructions.md` doesn't exist, create it from the source-of-truth client's memory file (or prompt user)
2. For each enabled client, get `adapter.getMemoryFileName()`
3. If the target file exists and is not a symlink, back it up as `.bak`
4. Create symlink: `target → .synctax/instructions.md`
5. For `.github/copilot-instructions.md`, create `.github/` directory if needed

### Reverse: `synctax unlink`
- For each symlink target, read content, delete symlink, write content as regular file
- Delete `.synctax/instructions.md` only if all unlinks succeed

### Git considerations
- `.synctax/instructions.md` should be committed (it's the canonical source)
- Symlink targets can be gitignored OR committed as symlinks (Git tracks symlinks as text files containing the target path)

### Implementation
- New file: `src/commands/link.ts`
- New tests: `tests/link.test.ts` (create symlinks in tmpdir, verify resolution)

### Effort: Medium (4-5 hours)
### Status: Implemented

## 3.5 MCP Health Checking

### Purpose
Verify MCP servers actually work, not just that config exists.

### Integration
Enhance existing `doctorCommand` with a `--deep` flag.

### Checks (--deep)
1. MCP `command` binary exists on PATH: `which npx`, `which bun`, etc.
2. Required env vars are set and non-empty
3. (Optional/future) Try spawning the MCP server process and checking for stdio response within timeout

### Output
```
$ synctax doctor --deep

  Client Health:
    ✓ Claude Code — detected
    ✓ Cursor — detected

  MCP Health:
    ✓ postgres — command "npx" found, env DB_URL set
    ⚠ notion — command "npx" found, env NOTION_TOKEN missing
    ✗ custom-tool — command "my-tool" not found on PATH
```

### Implementation
- Modify `src/commands/info.ts` `doctorCommand`
- Add `--deep` option in `bin/synctax.ts`

### Effort: Small (2-3 hours)
### Status: Implemented

## 3.6 `synctax add mcp <name> --from <url>`

### Purpose
Import MCP configs from GitHub gists, URLs, or registries instead of typing them manually.

### Supported formats
1. JSON object with McpServer fields: `{ "command": "npx", "args": [...], "env": {...} }`
2. Full Synctax config extract: `{ "mcps": { "name": {...} } }`
3. Raw gist URL → fetched and parsed

### Behavior
```
$ synctax add mcp postgres --from https://gist.github.com/.../postgres.json

  Fetching config from URL...
  ✓ Added MCP: postgres (command: npx, 2 args, 1 env var)
  Run `synctax sync` to push to all clients.
```

### Error handling
- Invalid URL → error with message
- Invalid JSON → error with parse message
- Network failure → error with retry suggestion

### Implementation
- Modify `src/commands/manage.ts` `addCommand`
- Add `--from` option in `bin/synctax.ts`

### Effort: Small (2-3 hours)
### Status: Implemented

## Delivered File Map

- `src/commands/diff.ts`
- `src/commands/validate.ts`
- `src/commands/link.ts`
- `src/commands/sync.ts` (rollback changes)
- `src/commands/info.ts` (doctor deep)
- `src/commands/manage.ts` (`--from` MCP import)
- `bin/synctax.ts` (CLI wiring)
- `src/interactive.ts` (interactive wiring)
- `src/commands/index.ts` (exports)

Tests added/expanded:

- `tests/diff.test.ts`
- `tests/validate.test.ts`
- `tests/sync-rollback.test.ts`
- `tests/link.test.ts`
- `tests/status.test.ts`
- `tests/profile-resolver.test.ts`
- `tests/commands.test.ts`
- `tests/profiles.test.ts`
- `tests/interactive.test.ts`
