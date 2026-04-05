# Synctax Features Reference

> **Universal Sync for the Agentic Developer Stack** — configure your AI toolchain once, sync everywhere.

---

## The Problem Synctax Solves

If you use more than one AI-powered IDE or CLI tool, you already know the pain:

- You add a new MCP server to Claude Code. Cursor still doesn't know about it.
- You craft the perfect system prompt and agent in Cursor. OpenCode doesn't have it.
- You join a new team, and spending 30 minutes reverse-engineering your colleague's `.cursor/mcp.json` just to get parity is now routine.
- You update a permission in one client. Three others still have the old (possibly insecure) version.

**Synctax eliminates that friction.** One master config at `~/.synctax/config.json`. One command to push to every client. Zero drift.

---

## Supported Clients

| Client | MCP Servers | Agents | Skills | Memory File |
|---|---|---|---|---|
| **Claude Code** | ✓ | ✓ (`.md`/`.agent` files) | ✓ (`.md` files) | `CLAUDE.md` |
| **Cursor** | ✓ | ✓ (Modes) | ✓ (Commands) | `.cursorrules` |
| **GitHub Copilot** (VS Code) | ✓ | — | — | `.github/copilot-instructions.md` |
| **GitHub Copilot CLI** | — | — | ✓ (Aliases) | `.github/copilot-instructions.md` |
| **OpenCode** | ✓ | ✓ | ✓ | `AGENTS.md` |
| **Cline** | ✓ | — | — | `.clinerules` |
| **Zed** | ✓ | — | — | `.rules` |
| **Antigravity** | ✓ | ✓ | ✓ | `.antigravityrules` |
| **Gemini CLI** | — | — | — | `.geminirules` |

**Scope support:** Claude Code, Cursor, OpenCode, Copilot, and Antigravity support project/user/global scoping. Resources sync to the appropriate file based on their `scope` field.

---

## What Gets Synced

### MCP Servers
Model Context Protocol servers — the tools your AI agents call. Each MCP has a `command`, optional `args`, optional `env` references, and a transport type (`stdio` or `sse`). Synctax translates each client's MCP key format (`mcpServers` vs `mcp.servers` vs `context_servers`) automatically.

### Agents
Named system prompts / personas your clients can activate. Synctax translates field names across clients (`prompt` → `systemPrompt` in Cursor, `system_message` in OpenCode) and handles file-based agents (Claude Code / Cursor) alongside JSON-based ones.

### Skills
Reusable instruction snippets or command aliases. Claude Code uses `.md` files with YAML frontmatter; Cursor uses "Commands"; Copilot CLI uses "Aliases". Synctax normalizes all of them.

### Permissions
Fine-grained access controls: allowed/denied file paths, allowed/denied shell commands, and network access. Uses **deny-wins** merge logic — if a path appears in both allow and deny, it is denied. This prevents accidental over-permissioning during profile merges.

### Models & Prompts
Default model selection (`defaultModel`) and global system instructions (`globalSystemPrompt`) per client. Synctax maps these to each client's native field names.

### Memory / Instruction Files
Per-project context files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, etc.) that AI clients read as persistent instructions. `synctax memory-sync` keeps all of them in lockstep from a single source file.

---

## Feature Categories

---

### A. Core Sync

**The daily driver — run after any config change.**

#### `synctax sync`

Reads the master config, applies the active profile filter, analyzes enabled clients with staged progress counters, previews what would change, asks for confirmation, then writes to enabled clients with bounded parallelism. If any write fails, all synced clients are rolled back from pre-sync snapshots.

```
synctax sync                  # interactive, staged progress + diff before writing
synctax sync --dry-run        # preview only, no writes
synctax sync --yes            # skip confirmation prompt
synctax sync --strict-env     # fail if any $VAR references are unresolved
synctax sync --interactive    # pick which resources to sync per-client
```

**When to use:** after adding/updating any MCP server, agent, or skill. Also after switching profiles.

**Runtime stages:** pull source -> resolve profile/env -> analyze clients -> backup -> write clients -> finalize.

---

#### `synctax pull --from <client>`

Reads a client's existing config files and imports them into the master config. Non-destructive merge — only adds or updates resources, never deletes existing master config entries.

```
synctax pull --from cursor        # import Cursor's MCPs, agents, skills
synctax pull --from claude        # import Claude Code's current config
synctax pull --from opencode      # import OpenCode's config
```

**When to use:** first-time setup (import your existing Cursor/Claude setup), or when you've made changes directly in a client and want to pull them back.

---

#### `synctax watch`

Starts a background daemon that watches `~/.synctax/config.json` for changes. When you save the file, it automatically syncs to all clients (500ms debounce to avoid partial-save triggers).

```
synctax watch                 # start daemon, blocks terminal
```

**When to use:** during active config editing sessions. Edit the master config in your text editor, save, and every client updates immediately.

---

#### `synctax memory-sync`

Copies the source client's memory/instruction file (e.g., `CLAUDE.md`) to all other enabled clients in the current project directory, translating filenames (`CLAUDE.md` → `.cursorrules` → `AGENTS.md` → `.rules`, etc.).

```
synctax memory-sync           # uses the configured source client
```

**When to use:** after updating your project's AI instructions and wanting all clients to reflect them.

---

### B. Inspection & Diagnostics

**Know before you sync.**

#### `synctax status`

Prints a health overview: which clients are enabled and detected, resource counts (MCPs, agents, skills), sync drift state, and env var resolution status.

```
synctax status
```

---

#### `synctax diff [client]`

Shows exactly what `synctax sync` would write without writing anything. Compares master config resources against each client's current on-disk state.

```
synctax diff              # diff all enabled clients
synctax diff cursor       # diff only Cursor
synctax diff --json       # machine-readable JSON output
```

**When to use:** before syncing in a new environment, in CI to detect drift, or when debugging why a client "isn't picking up" a change.

---

#### `synctax doctor [--deep]`

Diagnoses common issues: missing client config directories, broken file paths, invalid env var references, misconfigured scopes. With `--deep`, also verifies that MCP binary paths (the `command` field) actually exist on disk.

```
synctax doctor            # standard checks
synctax doctor --deep     # also verify MCP binary paths exist
```

---

#### `synctax validate`

Validates the master config against the Zod schema, checks all `$VAR` references can be resolved, and verifies required PATH binaries exist.

```
synctax validate
```

---

### C. Config Management

**Add, remove, and organize resources.**

#### `synctax add <type> <name>`

Interactively adds a new MCP server, agent, or skill to the master config. Supports inline flags for scripting.

```
synctax add mcp filesystem
synctax add mcp github --from https://gist.github.com/.../mcp.json
synctax add agent code-reviewer
synctax add skill daily-standup
```

The `--from <url>` flag on `add mcp` fetches the MCP definition from a URL or GitHub Gist — great for sharing MCP configs with teammates via a link.

---

#### `synctax remove [type] [name]`

Removes a resource from the master config. Interactive picker with `-i` when name is omitted.

```
synctax remove mcp filesystem
synctax remove agent code-reviewer -i   # pick from list
```

---

#### `synctax move <type> <name>`

Changes a resource's scope. Scope controls which config file the resource is written to on each client.

```
synctax move mcp filesystem --to-global    # sync to all scopes
synctax move mcp local-db --to-project     # only in current project
synctax move agent internal-only --to-local
```

**Scope levels:** `global` (home dir, available everywhere) → `user` → `project` (workspace only) → `local` (current dir only).

---

### D. Profiles

**Different configs for different contexts — work, freelance, open-source, demo.**

A profile is a named include/exclude filter applied before sync. Switch profiles to instantly change which MCP servers, agents, and skills are active.

```
synctax profile create work          # create a profile
synctax profile create freelance
synctax profile use work             # activate + sync immediately
synctax profile list                 # show all profiles, mark active
synctax profile diff personal        # preview before switching
```

#### Sharing profiles

```
synctax profile publish work         # export to shareable JSON (credentials stripped)
synctax profile pull https://...     # import a teammate's profile from URL
```

Profile imports use deny-wins merge logic — imported deny lists always win over your existing allow lists. Your credentials are never included in exports.

---

### E. Backup & Portability

**Back up before big changes, restore if something goes wrong.**

#### `synctax backup`

Creates timestamped zip backups of every enabled client's config files in their respective directories.

```
synctax backup                # per-client backups
synctax backup --rollup       # also creates a combined archive
```

---

#### `synctax restore`

Restores master config from a backup.

```
synctax restore                       # restore most recent backup
synctax restore --from 2026-04-01     # restore specific timestamp
```

---

#### `synctax export` / `synctax import`

Portable config snapshots for migration, onboarding, or archiving. Credentials are always stripped from exports.

```
synctax export my-config.json         # export (no credentials)
synctax import my-config.json         # import
```

---

#### `synctax link` / `synctax unlink`

Creates a symlink from each client's memory file (`.cursorrules`, `AGENTS.md`, etc.) to a single source file in the project. After linking, editing one file updates all clients' views.

```
synctax link                  # symlink all memory files to source
synctax unlink                # remove symlinks, restore independent files
```

---

### F. Interactive Dashboard (TUI)

**Run `synctax` with no arguments.**

Launches a fullscreen terminal dashboard with:

- **Status panel** — live client health, resource counts, drift indicator
- **Quick actions** — number keys (1–9, 0) trigger common commands directly
- **Command palette** — press `/` to fuzzy-search all commands
- **Diagnostics panel** — warnings and issues highlighted with color
- **Feature map** — categorized view of all active resources
- **Theme switcher** — press `t` to cycle through 16 built-in themes live
- **Source selector** — choose which client is the sync source of truth

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| `1`–`9`, `0` | Quick actions (sync, pull, status, diff, etc.) |
| `/` | Open command palette |
| `t` | Theme switcher |
| `s` | Source selector |
| `?` | Keyboard reference |
| `Esc` | Go back / close overlay |
| `q` | Quit |
| `Tab` / `Shift+Tab` | Cycle panel focus |
| `↑` / `↓` | Navigate lists |

**16 themes:** synctax, catppuccin, dracula, nord, tokyo-night, gruvbox, one-dark, solarized, rose-pine, monokai, cyberpunk, sunset, ocean, forest, ember, aurora. Theme choice persists in the master config.

---

## User Stories

### Marcus — Team Engineering Lead

*"I manage a team of 6 developers. Everyone uses different AI clients — half use Cursor, two use Claude Code, one uses Zed. Every time we adopt a new internal MCP server (our code search tool, our deploy MCP, our PR reviewer), I used to spend an afternoon on Slack sending JSON snippets and answering 'why isn't mine working' questions.*

*Now I publish a `team-mcps` profile to our internal wiki URL. Everyone runs `synctax profile pull <url>` and `synctax sync`. Done in 30 seconds. When we deprecate an old MCP, I update the profile, they pull again. No drift, no support tickets."*

**Key features used:** `profile pull`, `profile publish`, `sync`, `add mcp --from <url>`

---

### Sarah — Freelance AI Developer

*"I switch between 4–5 client projects per week, each with a completely different set of MCP servers, agents, and permissions. Before Synctax, switching contexts meant manually editing 3–4 config files per client, per project.*

*I created a profile for each client engagement — `client-a`, `client-b`, `agency-work`. When I open a new project, `synctax profile use client-a` + `synctax sync` and I'm in context in under 10 seconds. The `--strict-env` flag means if I forgot to set a secret, I get an error instead of a broken MCP."*

**Key features used:** `profile create/use`, `sync --strict-env`, `watch`

---

### Priya — Developer Migrating Between Tools

*"I'd built up 2 years of Cursor configuration — custom agents, MCP servers, permission rules. When I wanted to try Claude Code seriously, starting from scratch felt impossible.*

*`synctax pull --from cursor` imported everything in one shot. Then `synctax sync` pushed it to Claude Code. My agents translated to Claude's `.md` file format, my MCPs came across, my permissions mapped over. I was up and running in 5 minutes, and now I use both clients interchangeably — they stay in sync automatically."*

**Key features used:** `pull --from`, `sync`, `doctor --deep` (to verify MCP binaries)

---

### Jake — Developer Just Getting Started with AI Tools

*"I'm not a power user yet. I just wanted to add the filesystem MCP and a basic coding agent without editing JSON files manually.*

*`synctax add mcp filesystem` walked me through it interactively. `synctax add agent code-helper` let me paste a system prompt. Then `synctax sync` pushed it everywhere. `synctax doctor` told me one of my MCP paths was wrong before I even noticed. The TUI dashboard (`synctax` with no args) shows me everything in one view — I always know what's configured."*

**Key features used:** `add mcp/agent`, `sync`, `doctor`, TUI dashboard

---

## Full Command Reference

```
synctax [command] [options]

CORE SYNC
  sync                     Push master config to enabled clients (staged progress)
    --dry-run              Preview changes without writing
    --yes                  Skip confirmation prompt
    --strict-env           Fail if any $VAR references are unresolved
    --interactive          Pick resources to sync per-client
    --theme <name>         Override active theme for this run

  pull                     Import a client's config into master
    --from <client>        Client ID to pull from (required)

  watch                    Daemon: auto-sync on master config save (500ms debounce)

  memory-sync              Copy source memory file to all enabled clients

INSPECTION
  status                   Health overview: clients, resources, drift, env vars
  diff [client]            Preview changes without writing
    --json                 Machine-readable JSON output
  doctor                   Diagnose configuration issues
    --deep                 Also verify MCP binary paths exist
  validate                 Schema + env var + PATH validation

CONFIG MANAGEMENT
  add <type> <name>        Add a resource (type: mcp | agent | skill)
    --from <url>           Import MCP definition from URL or Gist
  remove [type] [name]     Remove a resource
    -i                     Interactive picker
  move <type> <name>       Change resource scope
    --to-global            Move to global scope
    --to-project           Move to project scope
    --to-local             Move to local scope

PROFILES
  profile create <name>    Create a named profile
  profile use <name>       Switch active profile and sync
  profile list             List all profiles, mark active
  profile diff <name>      Preview changes before switching
  profile pull <url>       Import profile from URL
  profile publish <name>   Export shareable profile (credentials stripped)

BACKUP & PORTABILITY
  backup                   Create per-client zip backups
    --rollup               Also create a combined archive
  restore                  Restore master config from backup
    --from <timestamp>     Restore specific backup
  export <file>            Export master config to JSON (no credentials)
  import <file>            Import master config from JSON
  link                     Symlink memory files to single source
  unlink                   Remove memory file symlinks

GLOBAL FLAGS (most commands)
  --theme <name>           Override active theme
  --version                Print version
  --help                   Print help

INTERACTIVE TUI
  synctax (no args)        Launch fullscreen dashboard
```

---

## Security Model

- **Deny-wins permissions**: when merging two permission sets (e.g., during `profile pull`), deny lists always override allow lists. A path in both allowed and denied is denied.
- **Credential isolation**: credentials are never included in `export`, `profile publish`, or any URL-based outputs. They live only in `~/.synctax/config.json` and per-profile `.env` files.
- **Env vault**: MCP `env` values can be `$VAR` references. Real values are stored in per-profile `.env` files (0600 permissions) and resolved only at sync time.
- **Atomic writes**: all client config writes use temp-file + rename to prevent partial-write corruption.
- **Pre-sync snapshots**: before any sync, Synctax snapshots all client configs. If any write fails, all clients are rolled back.
- **Path traversal protection**: all file path operations are validated to prevent directory traversal attacks.
