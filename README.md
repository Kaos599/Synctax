<p align="center">
  <strong>synctax</strong>
</p>

<p align="center">
  Universal Sync for the Agentic Developer Stack
</p>

<p align="center">
  <code>synctax sync</code> &mdash; one command, every AI tool in sync.
</p>

---

**synctax** is a cross-platform CLI that synchronizes your full AI development configuration &mdash; MCP servers, agents, skills, memory files, permissions, model preferences, and prompts &mdash; across **9 AI-powered IDE and CLI clients** from a single master config.

You configure once. Synctax distributes everywhere.

```
~/.synctax/config.json  ──synctax sync──>  Claude Code
                                           Cursor
                                           GitHub Copilot
                                           GitHub Copilot CLI
                                           OpenCode
                                           Cline
                                           Zed
                                           Antigravity
                                           Gemini CLI
```

---

## Why

Every AI coding tool stores configuration in its own format, at its own path, with its own key names. Add one MCP server and you're editing 4 different JSON files. Change a permission and you're hunting across `~/.claude/settings.json`, `~/.cursor/mcp.json`, `.vscode/mcp.json`, and more.

Synctax eliminates this. Write your config once, sync it everywhere, and never think about it again.

---

## Install

**Prerequisites:** [Bun](https://bun.sh) (v1.0+)

```bash
# Clone the repo
git clone https://github.com/Kaos599/synctax.git
cd synctax

# Install dependencies
bun install

# Initialize (detects installed AI clients, sets up master config)
bun ./bin/synctax.ts init

# Sync your config to all detected clients
bun ./bin/synctax.ts sync
```

### Adding to PATH (optional)

During `synctax init`, you'll be asked to add `~/.synctax/bin` to your PATH. If you accept (or pass `--yes`), you can run `synctax` directly from any terminal:

```bash
# After init with PATH setup + opening a new terminal:
synctax sync
synctax status
synctax doctor
```

| Flag | Effect |
|------|--------|
| `synctax init --yes` | Accept PATH install without prompting |
| `synctax init --no-path-prompt` | Skip PATH entirely |
| `synctax init --force` | Overwrite existing config |

---

## Quick Start

```bash
# 1. Initialize — detects your AI tools, asks you to pick a source of truth
synctax init

# 2. Sync — pulls from source, shows diff, asks confirmation, pushes to all
synctax sync

# 3. Check health
synctax doctor --deep

# 4. Add an MCP server
synctax add mcp my-db --command npx --args "-y,@modelcontextprotocol/server-postgres"

# 5. Sync again — one command, all tools updated
synctax sync
```

---

## Commands

### Core

| Command | Description |
|---------|-------------|
| `synctax sync` | Pull from source client, show diff, confirm, push to all enabled clients |
| `synctax pull --from <client>` | Import a specific client's config into master |
| `synctax memory-sync` | Sync memory/context files (CLAUDE.md, .cursorrules, etc.) across project |
| `synctax watch` | Background daemon that auto-syncs when master config changes |

### Config Management

| Command | Description |
|---------|-------------|
| `synctax init` | Detect clients, create master config, set source of truth |
| `synctax add <type> <name>` | Add an MCP server, agent, or skill |
| `synctax remove [type] [name]` | Remove a resource (interactive with `-i`) |
| `synctax move <type> <name>` | Change scope of a resource (`--to-global`, `--to-local`) |

### Inspection

| Command | Description |
|---------|-------------|
| `synctax status` | Health overview across all clients |
| `synctax diff [client]` | Preview add/remove/modify drift per client |
| `synctax validate` | Check config integrity, env vars, PATH commands |
| `synctax doctor [--deep]` | Diagnose issues; `--deep` verifies MCP commands exist |

### Profiles

| Command | Description |
|---------|-------------|
| `synctax profile create <name>` | Create a named profile with `--include` / `--exclude` filters |
| `synctax profile use <name>` | Switch active profile and sync |
| `synctax profile list` | List all profiles with active marker |
| `synctax profile diff <name>` | Preview which resources a profile includes/excludes |
| `synctax profile pull <url>` | Import a profile from a URL |
| `synctax profile publish <name>` | Export a profile (credentials automatically stripped) |

### Safety

| Command | Description |
|---------|-------------|
| `synctax backup` | Create zip archives of native client config files |
| `synctax restore [--from <ts>]` | Restore master config from a backup |
| `synctax export <file>` | Export master config to JSON |
| `synctax import <file>` | Import master config from JSON |
| `synctax link` / `unlink` | Symlink instruction files to a shared canonical file |

### Sync Flags

```bash
synctax sync --dry-run      # Preview changes without writing
synctax sync --yes           # Skip confirmation (for scripts, CI)
synctax sync --strict-env    # Fail if env vars fall back to process.env
synctax sync --interactive   # Select which resources to sync
```

---

## Fullscreen TUI

Running `synctax` with no arguments launches a fullscreen dashboard:

- Status overview (clients, MCPs, agents, skills, drift)
- 12 quick actions via hotkeys (1-9, 0)
- Searchable command palette (`/`)
- Source selector (`s`) and theme picker (`t`)
- 16 color themes

Requires a terminal at least 92x24. Falls back to interactive prompt mode on smaller viewports.

**Themes:** `synctax` (default), `catppuccin`, `dracula`, `nord`, `tokyo-night`, `gruvbox`, `one-dark`, `solarized`, `rose-pine`, `monokai`, `cyberpunk`, `sunset`, `ocean`, `forest`, `ember`, `aurora`

---

## Supported Clients

| Client | MCP | Agents | Skills | Memory File | Scopes |
|--------|:---:|:------:|:------:|-------------|--------|
| **Claude Code** | yes | yes | yes | `CLAUDE.md` | local, project, user |
| **Cursor** | yes | yes | yes | `.cursorrules` | project, user |
| **GitHub Copilot** | yes | yes | yes | `.github/copilot-instructions.md` | project, user |
| **GitHub Copilot CLI** | yes | yes | yes | `.github/copilot-instructions.md` | local, project, user |
| **OpenCode** | yes | yes | yes | `AGENTS.md` | project, user, global |
| **Cline** | yes | -- | -- | `.clinerules` | user |
| **Zed** | yes | -- | -- | `.rules` | user |
| **Antigravity** | yes | yes | yes | `GEMINI.md` | project, user |
| **Gemini CLI** | -- | -- | -- | `.geminirules` | project, user |

---

## How Sync Works

```
                    synctax sync
                         |
            1. Pull from source client (e.g. Claude Code)
                         |
            2. Merge into master config (deny-wins for permissions)
                         |
            3. Apply active profile filters
                         |
            4. Resolve env vault ($VAR -> actual values)
                         |
            5. Show diff preview per client
                         |
            6. Confirm: "Apply these changes? [y/N]"
                         |
            7. Write to all enabled clients (atomic writes)
                         |
            8. On failure: rollback previously synced clients
```

**Safety guarantees:**
- All file writes are atomic (write to temp, rename into place)
- File lock prevents concurrent syncs from corrupting data
- Snapshot taken before writing; rolled back on failure
- Permissions use merge-conservative logic (deny always wins)
- Env vault secrets are resolved at sync time only, never stored in master config

---

## Env Vault

MCP servers often need API keys and database URIs. Synctax's env vault keeps secrets separate from config:

```json
// ~/.synctax/config.json — safe to share
{
  "mcps": {
    "my-db": {
      "command": "npx",
      "args": ["-y", "@mcp/postgres"],
      "env": { "DB_URL": "$MY_DB_URL" }
    }
  }
}
```

```bash
# ~/.synctax/envs/default.env — never leaves your machine
MY_DB_URL=postgres://user:pass@prod.db.internal:5432/app
```

At sync time, `$MY_DB_URL` resolves to the actual value and is written into each client's config. The master config only stores references.

Each profile gets its own `.env` file. Switching profiles switches env context automatically.

---

## Profiles

Profiles filter which resources sync to your clients. Useful for:
- **Freelancers** switching between client projects
- **Teams** with shared base configs + personal overrides
- **Multi-environment** setups (dev vs staging vs prod MCPs)

```bash
# Create a profile that only includes specific resources
synctax profile create work --include "company-db,jira,code-reviewer"

# Switch profiles (automatically syncs)
synctax profile use work

# See what a profile includes/excludes
synctax profile diff work
```

---

## Project Structure

```
bin/synctax.ts              CLI entrypoint
src/
  adapters/                 9 client adapters (translate master -> client format)
  commands/                 Command implementations (init, sync, pull, profile, etc.)
  tui/                      Fullscreen TUI (Ink/React components, 16 themes)
  ui/                       CLI output utilities (colors, spinner, table, timer)
  config.ts                 ConfigManager (read/write/backup master config)
  types.ts                  Zod schemas + TypeScript types
  diff-utils.ts             Shared diff comparison utilities
  fs-utils.ts               Atomic file write helpers
  lock.ts                   Exclusive file lock for concurrency safety
  env-vault.ts              Per-profile env var resolution
tests/                      444 tests across 48 suites (Vitest)
docs/
  specs/                    Design specs
  roadmap/                  Phase documentation
```

---

## Development

```bash
# Run all tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint

# Run a specific test
bunx vitest run tests/adapters.test.ts

# Run CLI directly
bun ./bin/synctax.ts <command>
```

---

## License

MIT
