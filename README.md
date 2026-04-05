<p align="center">
  <img src="assets/banner.svg" alt="Synctax" width="480">
</p>

<p align="center"><strong>Universal Sync for the Agentic Developer Stack</strong></p>
<p align="center">Configure once. Sync your MCP servers, agents, skills, and permissions to every AI tool you use.</p>

<p align="center">
  <a href="https://github.com/Kaos599/Synctax/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Kaos599/Synctax/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/synctax"><img alt="npm" src="https://img.shields.io/npm/v/synctax?color=brightgreen" /></a>
  <img alt="license" src="https://img.shields.io/github/license/Kaos599/Synctax?color=blue" />
  <img alt="runtime" src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" />
  <img alt="clients" src="https://img.shields.io/badge/clients-9%20supported-lightgrey" />
</p>

<p align="center"><code>synctax sync</code> — one command, every AI tool in sync.</p>

---

## Why Synctax

Every AI coding tool stores configuration in its own proprietary format. Claude Code reads `~/.claude/settings.json`. Cursor uses `~/.cursor/mcp.json`. Zed has `~/.config/zed/settings.json`. Cline, OpenCode, GitHub Copilot, and Gemini CLI each have their own layouts, their own field names, and their own ideas about where agents and skills belong.

Add one MCP server and you are editing four JSON files by hand. Rename an agent and you are hunting through six different directories. Forget to update one client and your tools are silently out of sync for weeks.

Synctax eliminates this. One master config at `~/.synctax/config.json`. One command to push it everywhere. Every resource — MCP servers, agents, skills, permissions, model preferences, prompts, memory files — translated into each client's native format automatically.

---

## Install

```bash
npm install -g synctax
```

Works with npm, pnpm, yarn, or Bun:

```bash
pnpm add -g synctax
yarn global add synctax
bun add -g synctax
```

**Requires Node.js ≥18.** No other runtime needed — Synctax is a self-contained bundle.

Then initialize:

```bash
synctax init
```

---

## Quick Start

```bash
# 1. Initialize master config and enable your installed clients
synctax init

# 2. Pull your existing config from whichever client you use most
synctax pull --from cursor

# 3. Add a new MCP server to master config
synctax add mcp my-db --command npx --args "-y" "@modelcontextprotocol/server-postgres" --env DB_URL=\$MY_DB_URL

# 4. Check for issues before writing
synctax doctor

# 5. Push everything to all enabled clients
synctax sync
```

---

## Commands

### Core

| Command | Description |
|---------|-------------|
| `synctax sync` | Pulls from your source client, shows a per-client diff, asks for confirmation, then writes to every enabled client atomically. Rolls back all clients on failure. Run this after any change to master config. |
| `synctax pull --from <client>` | Imports a specific client's live config into master. Use this when you've added an MCP directly in Cursor or Claude Code and want master to reflect it. |
| `synctax diff [client]` | Compares master against each client's live config and shows exactly what has been added, removed, or modified — without writing anything. Safe to run at any time. |
| `synctax watch` | Starts a background daemon that watches `~/.synctax/config.json` and auto-syncs on every save (500ms debounce). Useful when editing master config directly. |
| `synctax memory-sync` | Copies your source client's memory/context file (e.g. `CLAUDE.md`) to all other enabled clients in the current project directory. |

### Inspection

| Command | Description |
|---------|-------------|
| `synctax status` | Health overview across all clients — shows sync state, resource counts, and env var status at a glance. |
| `synctax doctor [--deep]` | Diagnoses common issues: missing clients, broken config paths, invalid env vars. With `--deep`, also verifies each MCP command exists on PATH. |
| `synctax validate` | Runs Zod schema validation on master config, checks env var references can resolve, and confirms required binaries are reachable before syncing. |

### Config Management

| Command | Description |
|---------|-------------|
| `synctax add <type> <name>` | Adds an MCP server, agent, or skill to master config interactively or via flags. |
| `synctax remove [type] [name]` | Removes a resource. Use `-i` for interactive selection. |
| `synctax move <type> <name>` | Changes the scope of a resource (`--to-global`, `--to-local`, `--to-project`). |

### Profiles

| Command | Description |
|---------|-------------|
| `synctax profile create <name>` | Creates a named profile with `--include` / `--exclude` resource filters. Each profile gets its own `.env` file for secrets. |
| `synctax profile use <name>` | Switches to a profile and immediately syncs — swaps env context and filters, then pushes to all clients. |
| `synctax profile list` | Lists all profiles with their filters and marks the active one. |
| `synctax profile diff <name>` | Dry-run preview of what would change if you switched to this profile, without switching. |
| `synctax profile pull <url>` | Downloads and imports a shared profile from a URL. Credentials are never included. |
| `synctax profile publish <name>` | Exports a profile to a shareable JSON file with credentials automatically stripped. |

<details>
<summary>Safety &amp; backup commands</summary>

| Command | Description |
|---------|-------------|
| `synctax backup` | Archives each enabled client's current native config files into a timestamped zip at `~/.synctax/backups/`. Run before risky changes. |
| `synctax restore [--from <ts>]` | Restores master config from a backup. Uses most recent by default; pass a timestamp for a specific point in time. |
| `synctax export <file>` | Exports the full master config to a portable JSON file (credentials stripped). |
| `synctax import <file>` | Imports a master config from a JSON file. |
| `synctax link` / `synctax unlink` | Creates symlinks so all client instruction files point to one canonical file, or restores them as regular files. |

</details>

### Sync Flags

```bash
synctax sync --dry-run        # Preview changes without writing
synctax sync --yes            # Skip confirmation (for scripts, CI)
synctax sync --strict-env     # Fail if env vars can't resolve
synctax sync --interactive    # Select which resources to sync
```

---

## Supported Clients

| Client | MCP | Agents | Skills | Memory File |
|--------|-----|--------|--------|-------------|
| Claude Code | ✅ | ✅ | ✅ | `CLAUDE.md` |
| Cursor | ✅ | ✅ | ✅ | `.cursorrules` |
| OpenCode | ✅ | ✅ | ✅ | `AGENTS.md` |
| Antigravity | ✅ | ✅ | ✅ | `.antigravityrules` |
| GitHub Copilot (VS Code) | ✅ | — | — | `.github/copilot-instructions.md` |
| GitHub Copilot CLI | — | — | ✅ | `.github/copilot-instructions.md` |
| Cline | ✅ | — | — | `.clinerules` |
| Zed | ✅ | — | — | `.rules` |
| Gemini CLI | — | — | — | `.geminirules` |

---

## How Sync Works

```
synctax sync
       │
       ├─ 1. Pull from source client
       │       Read live config → merge into master (deny-wins for permissions)
       │
       ├─ 2. Apply active profile filters
       │       include/exclude lists trim the resource set
       │
       ├─ 3. Resolve env vault
       │       $VAR references → real values from ~/.synctax/envs/<profile>.env
       │
       ├─ 4. Show diff preview per client
       │       added / removed / modified resources listed before any write
       │
       ├─ 5. Confirm: "Apply these changes? [y/N]"
       │
       └─ 6. Atomic write to all enabled clients
               temp-file → rename · file lock · rollback on failure
```

**Safety guarantees:**

- Every client config is read before being written — Synctax fields are overlaid, not overwritten.
- All writes go to a temp file first, then renamed atomically. A crash mid-write leaves the original intact.
- If any client write fails, all clients that already received changes in this run are rolled back.
- Permission merges use deny-wins logic: if a path appears in both allow and deny lists, it is denied.

---

## Env Vault

Secrets never live in master config. Use `$VAR` references in config and store real values in a per-profile `.env` file that stays local.

```json
// ~/.synctax/config.json — safe to commit or share
{
  "mcps": {
    "my-db": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DB_URL": "$MY_DB_URL" }
    }
  }
}
```

```bash
# ~/.synctax/envs/default.env — stays local, never exported
MY_DB_URL=postgres://user:pass@prod.db.internal:5432/app
```

When syncing, `$MY_DB_URL` is resolved to the real value before writing to each client. The reference string is what gets synced; the secret is what gets injected at write time.

---

## Fullscreen TUI

Run `synctax` with no arguments to open the fullscreen dashboard.

- Live status panel: connected clients, MCP counts, agent counts, drift indicators
- Quick actions grid: bind common commands to number keys (1–9, 0)
- Command palette: fuzzy-search all commands with `/` or `p`
- Source selector: pick which client to pull from interactively
- Diagnostics panel: warnings and config issues surfaced in real time
- 16 built-in themes: `synctax`, `catppuccin`, `dracula`, `nord`, `tokyo-night`, `gruvbox`, `one-dark`, `solarized`, `rose-pine`, `monokai`, `cyberpunk`, `sunset`, `ocean`, `forest`, `ember`, `aurora` — press `t` to cycle

---

## Profiles

Profiles are named resource filters that let you maintain different sync configurations for different contexts — work vs. personal, frontend vs. backend, client A vs. client B — without maintaining separate master configs. Each profile has its own `.env` file so secrets are scoped too.

```bash
# Create a work profile that only includes work-related MCPs and agents
synctax profile create work --include my-db,github,jira-agent,code-reviewer

# Switch to it (syncs immediately with the filtered resource set)
synctax profile use work

# Preview what switching to personal would change before committing
synctax profile diff personal
```

---

## Development

**Prerequisites for contributing:** [Bun](https://bun.sh) v1.0+

```bash
git clone https://github.com/Kaos599/synctax.git
cd synctax
bun install

# Run the CLI directly from source
bun ./bin/synctax.ts <command>

# Run all tests
bun run test

# Type-check (strict, no emit)
bun run typecheck

# Lint
bun run lint

# Run a single test file
bunx vitest run tests/adapters.test.ts

# Build the Node.js bundle (what gets published to npm)
bun run build
```

---

## License

MIT
