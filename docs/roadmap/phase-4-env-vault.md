# Phase 4: Env Vault + Native Client Backup Rollups

**Status**: In Progress (backup + env scaffold landed; quality baseline established, strict gates still blocked by warnings)
**Estimated effort**: 18-24 hours
**Depends on**: Phase 3.3 (backup+rollback for safe sync)

## Vision

Two coordinated capabilities:

1. A centralized secrets/environment manager where each profile has its own `.env` file.
2. A native backup system that creates real zip archives of client files across scopes.

When switching profiles, Synctax loads the corresponding env vars and injects resolved values into each client's config during sync. For backups, Synctax packages each client's actual files (not just Synctax schema JSON) into zip files saved in client-owned folders.

## 4.1 Env Vault Architecture

### Directory structure
```
~/.synctax/
  config.json          — master config (existing)
  envs/
    default.env        — env vars for default profile
    work.env           — env vars for work profile
    personal.env       — env vars for personal profile
```

### How it works

1. Master config MCPs reference env vars symbolically:
   ```json
   {
     "mcps": {
       "postgres": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-postgres"],
         "env": { "DB_URL": "$POSTGRES_URL" }
       }
     }
   }
   ```

2. Each profile has an associated `.env` file:
   ```env
   # ~/.synctax/envs/work.env
   POSTGRES_URL=postgres://work-db:5432/prod
   API_KEY=sk-work-abc123
   ```

3. On `synctax profile use work`:
   - Load `~/.synctax/envs/work.env`
   - Resolve `$POSTGRES_URL` → `postgres://work-db:5432/prod`
   - Write resolved values into each client's config during sync

4. On `synctax profile use personal`:
   - Load `~/.synctax/envs/personal.env`
   - Different values injected into same MCP structure

### Resolution algorithm

```
For each MCP env entry:
  If value starts with "$":
    varName = value.slice(1)
    1. Look up varName in current profile's .env file
    2. If not found, fall back to process.env[varName]
    3. If not found, leave as "$VAR" (unresolved) and warn
  Else:
    Use value as-is (literal)
```

### Security

- `.env` files use 0600 permissions (owner read/write only)
- `.env` files are NEVER synced, exported, or published
- `synctax profile publish` strips resolved values, keeps `$VAR` references
- `synctax export` keeps `$VAR` references, never resolves
- `.env` files should be in `.gitignore`

## 4.2 Env Commands

### `synctax env set <key> <value>`
Set an env var in the current profile's .env file.
```
$ synctax env set POSTGRES_URL postgres://localhost:5432/dev
  ✓ Set POSTGRES_URL in personal.env
```

### `synctax env list`
Show env vars for the current profile (values masked by default).
```
$ synctax env list
  Profile: work (3 vars)

  POSTGRES_URL    postgres://wo...32/prod
  API_KEY         sk-work-***
  GITHUB_TOKEN    ghp_***

  Use --show to reveal full values.
```

### `synctax env edit`
Open the current profile's .env file in `$EDITOR`.
```
$ synctax env edit
  Opening ~/.synctax/envs/work.env in vim...
```

### `synctax env delete <key>`
Remove a key from the current profile's .env.

## 4.3 Profile-Env Integration

### Automatic behavior
- `synctax profile create work` → also creates `~/.synctax/envs/work.env` (empty)
- `synctax profile use work` → loads work.env, then triggers sync with resolved values
- If .env file missing for profile → create empty one, warn user

### Backwards compatibility
- If no `~/.synctax/envs/` directory exists → behavior unchanged
- If .env file is empty → `$VAR` references fall back to `process.env`
- Existing configs with literal values in `env` → work as-is

## 4.4 Native Client Backup + Rollup (Zip)

### Purpose

Provide a true client-level backup that is explicitly different from `synctax export` / `synctax import`.

- `export/import`: backs up Synctax master config schema.
- `backup`: archives raw client files and folders exactly as they exist.

### User requirement captured

- Backup should include all discovered scopes per client (user, project, local, and other supported scopes).
- Backup artifact should be placed in the client's own folder (e.g. Claude backup file inside the Claude config folder).
- Backup should cover all enabled clients by default.

### Command surface (Phase 4)

#### `synctax backup`

Create one zip per enabled client in that client's root config directory.

Example:

```bash
$ synctax backup

✓ claude: ~/.claude/synctax-backup-2026-03-25T20-12-10.zip
✓ cursor: ~/.cursor/synctax-backup-2026-03-25T20-12-10.zip
✓ opencode: ~/.config/opencode/synctax-backup-2026-03-25T20-12-10.zip

Done in 1.2s · 3 client backups created
```

#### `synctax backup --client <id>`

Back up only one client.

#### `synctax backup --rollup`

In addition to per-client zip files, create a rollup zip with backup manifest + pointers to created client archives.

### Scope inclusion rules

For each client, include all resolvable paths in this priority model:

1. user/global scope files
2. project scope files for current working directory
3. local scope files where applicable

The archive should preserve relative paths so restore can be deterministic later.

### Destination rules

- Per-client zip destination is the client's own config root directory.
- Filename format: `synctax-backup-<timestamp>.zip`.
- No backup zip should be written into the Synctax config folder by default for this command.

### Data included

- Client config files (JSON/settings)
- Client agent files
- Client skill files
- Client memory/rule files for current project when in scope
- Optional metadata manifest inside each archive (`manifest.json`) listing included files and SHA256 checksums

### Data excluded

- Synctax `.bak` snapshots
- `node_modules`, build artifacts, cache directories
- temporary lock files that are regenerated and not user-authored

## 4.5 Backup Edge Cases

| Scenario | Behavior |
|----------|----------|
| Client has no detectable files | Skip with warning, continue others |
| Path exists but unreadable | Warn and continue; mark partial backup |
| Project scope not found | User scope backup still succeeds |
| Existing backup filename collision | Append incrementing suffix |
| Rollup creation fails | Keep per-client backups and report partial success |

## 4.6 Implementation (Phase 4)

## Implementation

### New files
- `src/env-vault.ts` — EnvVault class: loadEnv(profile), resolveEnv(resources), setVar, listVars
- `src/commands/env.ts` — envSetCommand, envListCommand, envEditCommand, envDeleteCommand
- `src/backup.ts` — Backup service: discover client files by scope, create per-client zip, build rollup manifest
- `src/commands/backup.ts` — `backupCommand` (+ optional list/verify helpers)
- `tests/env-vault.test.ts`
- `tests/env.test.ts`
- `tests/backup.test.ts`

### Modified files
- `src/commands/sync.ts` — resolve env vars before adapter.write()
- `src/commands/profile.ts` — create .env on profile create, load on profile use
- `bin/synctax.ts` — register env commands
- `src/commands/index.ts` — export new commands
- `src/adapters/*` — add backup path discovery helpers per adapter (all scopes)
- `src/interactive.ts` — register backup flow in interactive mode

### Zod schema additions (src/types.ts)
```typescript
// No schema changes needed — env vault is external to config.json
// The .env files are managed separately, not in the Zod schema
```

## .env File Format

Standard dotenv format:
```
# Comment lines start with #
KEY=value
ANOTHER_KEY=another value
# Quotes are optional but supported
QUOTED="value with spaces"
```

Parser: Use a minimal built-in parser (split on first `=`, trim, handle `#` comments) or add `dotenv` as a dependency. Recommend built-in for zero-dep simplicity.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `$VAR` in env, but .env missing | Fall back to process.env |
| `$VAR` not in .env or process.env | Leave as `$VAR` in client config, print warning |
| Switching profiles rapidly | Each switch triggers full sync — debounce not needed (manual action) |
| Two profiles share same MCP with different envs | Each profile resolves to its own values — this is the core use case |
| Env file has syntax error | Log parse error, skip that line, continue |

## Acceptance Criteria

- `synctax backup` creates per-client zip backups in client directories.
- Backups include client files across user/project/local scopes where available.
- `synctax backup --rollup` produces an additional rollup artifact with manifest.
- Feature is clearly documented as distinct from `export/import`.
- Automated tests validate path discovery, archive contents, and partial-failure behavior.

## Current Branch Verification Snapshot (2026-03-25)

- `bunx vitest run tests/interactive.test.ts -v` — PASS
- `bunx vitest run tests/commands.test.ts tests/profiles.test.ts -v` — PASS
- `bunx vitest run tests/integration/e2e.test.ts -v` — PASS
- `bunx vitest run tests/env-vault.test.ts tests/backup.test.ts -v` — PASS
- `bun run test` — PASS (377 tests across 39 files)
- `bunx tsc --noEmit` — PASS (0 errors)

## Remaining Phase 4 Work

- Implement env command surface in `src/commands/env.ts` and CLI wiring (`env set/list/edit/delete`).
- Finalize backup default destination semantics and align docs/UX around bundle vs per-client default behavior.
- Burn down lint warnings to unlock strict hard-gate promotion (`lint:strict` and `check:strict` currently fail on warnings only).
