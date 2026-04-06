---
title: Synctax PRD & Architecture Document
description: Extreme-detail Product Requirements Document and Architectural Deep Dive for Synctax v1.5+.
contents:
  - Product Context & Use Cases: The 'Why' behind Synctax.
  - Architecture Overview: Core engine, Daemon Layer, and CLI Matrix UI.
  - Client Handling (Extreme Detail): Exhaustive documentation on how every supported AI client (Claude Code, Cursor, Zed, OpenCode, Cline, Github Copilot, Github Copilot CLI, Gemini CLI, Antigravity) is parsed, written to, and managed.
glossary:
  - Adapter: The translation layer inside src/adapters/ bridging the Synctax config.json to client-specific structures.
  - config.json: The master source of truth, typically ~/.synctax/config.json.
  - MCP: Model Context Protocol servers.
  - Zod: The schema validation library enforcing types in Synctax.
  - Daemon: The chokidar-powered background sync runner (synctax watch).
---

# Synctax PRD & Architecture

## 1. Product Context & Use Cases

### The "Why"
Developers operate in heavily fragmented AI environments. They bounce between Claude Code for deep terminal CLI work, Cursor for codebase refactoring, and Zed for blazing-fast editing. Bouncing between these environments requires painstakingly rewriting rules, redefining context files (`.cursorrules` vs `CLAUDE.md`), and copying massive MCP (Model Context Protocol) config blocks into varying proprietary JSON locations (`.claude/settings.json`, `.vscode/settings.json`, `.config/zed/settings.json`).

`synctax` eliminates this "sync tax". It acts as the ultimate cross-platform bridge, establishing a single master `.synctax/config.json` that dictates reality across all installed clients simultaneously.

### Core Use Cases
1. **Zero-Friction Context Porting:** A developer updates their global system prompt or `.synctaxrules` memory file. The daemon automatically propagates it to `.cursorrules`, `.clinerules`, and `CLAUDE.md`.
2. **Unified MCP Management:** Installing an MCP server (e.g., SQLite or Postgres) happens once in Synctax, which then injects the `command`, `args`, and `env` into every supported client's specific JSON structure.
3. **Visibility Blindness Cure:** A developer runs `synctax info` to instantly view a tabular Matrix Dashboard detailing exactly which AI clients are missing certain MCPs, agents, or skills.
4. **Secure Secret Stripping:** When a team shares a configuration profile, Synctax safely strips `$ENV_VAR` credentials before pushing them.
5. **Merge-Conservative Permissions:** If Claude Code is denied network access but Cursor is allowed, Synctax enforces a strict deny-list override across the board, guaranteeing security consistency.

---

## 2. Architecture Overview

### 2.1 The Core Engine
The core of Synctax is a central configuration state defined entirely by Zod schemas in `src/types.ts`.
- The engine uses `ConfigManager` to interact with `~/.synctax/config.json`.
- All paths are sandboxed. In tests, everything roots to `process.env.SYNCTAX_HOME` to prevent developers from overwriting their local configs via `bun run test`.

### 2.2 The CLI Layer
- Powered by Commander.js alongside an integrated Interactive Mode utilizing `@inquirer/prompts`.
- **Standard Execution (`synctax`)**: Running the CLI with zero arguments intercepts the standard Commander help output and dynamically drops the user into an interactive, searchable command palette with "hover" descriptions for each command.
- **`synctax init`** ends with an interactive PATH offer (when stdin is a TTY): install `~/.synctax/bin` and update the user environment so `synctax` is on PATH. Non-interactive runs use `init --yes` or `init --no-path-prompt`; tests and CI skip the prompt automatically.
- Uses `cli-table3` to print a gorgeous dashboard of installed clients and their specific resource metrics (e.g., "Cursor | Yes | 3 MCPs | 2 Agents | 1 Skill").
- Startup banner: Uses the `synctax` wordmark by default. CLI themes also include `rebel` and legacy line-art palettes (`default`, `cyber`, `green`) plus `pixel`/`synctax` for the wordmark.

### 2.3 The Daemon Layer (`synctax watch`)
- Uses `chokidar` to run silently in the background.
- It continuously monitors `~/.synctax/config.json` for file saves.
- Uses a robust 500ms debounce mechanism to prevent I/O spam. When a change is detected, it triggers a `syncCommand` cascade, automatically pushing updates to all enabled clients.

### 2.4 The Adapters Layer
This is the most complex logic. Adapters (e.g., `ClaudeAdapter`, `CursorAdapter`) implement the `ClientAdapter` interface. They handle reading and writing custom configurations. They translate Zod `McpServer` properties into whatever custom key the specific client requires (`mcp.servers` vs `mcpServers` vs `context_servers`).

---

## 3. Client Handling (Extreme Detail)

This section exhaustively defines how Synctax translates its master configuration for the 9 supported AI clients.

### 3.1 Claude Code (`src/adapters/claude.ts`)
- **Directory**: `~/.claude`
- **Config File**: `~/.claude/settings.json`
- **Memory File**: `CLAUDE.md` (Project root)
- **Scope**: Global only
- **Agents Dir**: `~/.claude/agents/`
- **Skills Dir**: `~/.claude/skills/`
- **Handling**:
  - **MCPs**: Maps to `mcpServers` in `settings.json`.
  - **Agents & Skills**: Claude natively supports agent and skill files. Synctax uses an advanced file extension parser that comprehensively scrapes `*.md`, `*.agent`, `*.agents`, and `*.claude` files inside their respective directories. It parses YAML frontmatter (`---`) for `name`, `description`, `trigger`, and `model`, treating the body as the prompt/content.
  - **Models/Prompts**: Maps `preferredModel` to `models.defaultModel` and `customInstructions` to `prompts.globalSystemPrompt`.
  - **Permissions**: Maps deeply: `allow_paths`, `deny_paths`, `bash_allow`, `bash_deny`, `network_allow`.

### 3.2 Cursor (`src/adapters/cursor.ts`)
- **Directory**: `~/.cursor`
- **Config File**: `~/.cursor/mcp.json`
- **Modes File**: `~/.cursor/modes.json`
- **Commands Dir**: `~/.cursor/commands/`
- **Memory File**: `.cursorrules` (Project root)
- **Scope**: Global only
- **Handling**:
  - **MCPs**: Maps to `mcpServers` in `mcp.json`.
  - **Agents**: Cursor calls these "Modes". Synctax reads and writes to `modes.json`, mapping `name`, `description`, `systemPrompt`, and `model`.
  - **Skills**: Cursor calls these "Commands" (typically `.md` files). Synctax treats files in `~/.cursor/commands/` as skills, parsing basic frontmatter or falling back to raw markdown, assigning a default trigger of `/{filename}`.

### 3.3 Zed (`src/adapters/zed.ts`)
- **Config File**: `~/.config/zed/settings.json`
- **Memory File**: `.rules` (Project root)
- **Scope**: Global only
- **Handling**:
  - **MCPs**: Maps to the unique key `context_servers` in `settings.json`.
  - **Agents/Skills**: Zed currently lacks native isolated agent/skill file storage comparable to Claude/Cursor. Synctax only syncs MCPs and memory files for Zed.

### 3.4 Cline (`src/adapters/cline.ts`)
- **Directory**: `~/.cline`
- **MCP Files**: `~/.cline/mcp_settings.json` (legacy), `~/.cline/data/settings/cline_mcp_settings.json` (current)
- **Config Files**: `~/.cline/config.json` and platform XDG variants
- **Memory File**: `.clinerules` (Project root)
- **Scope**: User + Global fallback
- **Handling**:
  - **MCPs**: Maps to `mcpServers` in `mcp_settings.json`/`.config/`-scoped variants.
  - **Permissions**: Maps `networkAllow` to `autoApproveNetwork` (boolean), and `allowedCommands` to `autoApproveCommands` in `settings.json`.
  - **Models**: Maps `model` in `settings.json`.

### 3.5 OpenCode (`src/adapters/opencode.ts`)
- **Config Files**:
  - Project: `./opencode.json` or `./.opencode/config.json`
  - User: `~/.config/opencode/config.json`, `~/.opencode/config.json`
- **Scope**: Project > User
- **Memory File**: `AGENTS.md` (Project root)
- **Handling**:
  - **MCPs**: Maps to `mcp` in `config.json`.
  - **Agents**: Maps to the `agents` object. Note that OpenCode uses `system_message` instead of `prompt`.
  - **Skills**: Maps to the `skills` object.

### 3.6 Antigravity (`src/adapters/antigravity.ts`)
- **Config Files**:
  - Global fallback: `~/.antigravity/config.json`
  - User: `~/.antigravity_tools/gui_config.json`, `~/.config/antigravity/config.json`
- **Scope**: User + Global fallback
- **Memory File**: `.antigravityrules` (Project root)
- **Handling**:
  - **MCPs**: Maps to `mcpServers`.
  - **Agents**: Maps to the `agents` object, using `prompt` and `model`.
  - **Skills**: Maps to the `skills` object, using `content` and `trigger`.

### 3.7 Github Copilot (`src/adapters/github-copilot.ts`)
- **Config files**: VS Code **user** `settings.json` (`mcp.servers`) and/or **user** `mcp.json` (`servers`, Copilot MCP UI) — see `vscodeUserSettingsCandidates` / `vscodeUserMcpJsonCandidates` (e.g. `%APPDATA%\Code\User\` on Windows). Workspace `.vscode/` fallbacks included.
- **Scope**: Project `.vscode/*` > User `%APPDATA%\Code\User`
- **Memory File**: `.github/copilot-instructions.md` (Project root)
- **Handling**:
  - **MCPs**: Maps to the unique key `mcp.servers` in `settings.json`.
  - **Agents/Skills**: Copilot does not have standard local agent/skill configurations managed this way. Focus is on MCPs and standard Copilot instructions.

### 3.8 Github Copilot CLI (`src/adapters/github-copilot-cli.ts`)
- **Config Files**:
  - Project: `.github/copilot/config.json`
  - User: `~/.config/github-copilot-cli/config.json`, `~/.config/copilot/config.json`
- **Scope**: Project > User > Global
- **Memory File**: `.github/copilot-instructions.md` (Project root, shared with standard Copilot)
- **Handling**:
  - **Skills**: Synctax maps skills directly to the `aliases` object in `config.json`, leveraging the CLI's native alias system as pseudo-skills.

### 3.9 Gemini CLI (`src/adapters/gemini-cli.ts`)
- **Config Files**:
  - Project: `./.gemini/settings.json`
  - User: `~/.gemini/settings.json`
  - Legacy fallback: `~/.gemini/config.json`, `~/.config/gemini/config.json`
- **Scope**: Project > User
- **Memory File**: `.geminirules` (Project root)
- **Handling**:
  - **Models**: Maps `defaultModel` to `model` in `config.json`.
  - **Prompts**: Maps `globalSystemPrompt` to `systemInstruction`.
  - **Agents/Skills**: Focuses exclusively on model assignment and base system instructions.

### 3.10 Scope Matrix (v2 — Updated March 2026)

> **NOTE**: The scope information below reflects deep research conducted in March 2026. Several adapters had incorrect assumptions previously. See `docs/research/clients.md` for full details.

| Client | MCP location | Agents location | Skills location | Memory file | Scopes supported |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `.mcp.json` (project), `~/.claude.json` (user) | `agents/*.md` (frontmatter, 14 fields) | `skills/<name>/SKILL.md` (11 fields) | `CLAUDE.md` | local, project, user |
| Cursor | `.cursor/mcp.json` (project), `~/.cursor/mcp.json` (user) | Modes (cloud-managed?) | `commands/*.md` + `skills/<name>/SKILL.md` | `.cursorrules` | project, user |
| OpenCode | `opencode.json` → `mcp` (array command!) | `agent` (singular) → `prompt` | `skills/<name>/SKILL.md` | `AGENTS.md` | project, user, global |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | `GEMINI.md` + `.agent/rules/*.md` | `.agents/skills/<name>/SKILL.md` | `GEMINI.md` | project, user |
| Copilot VS Code | `.vscode/mcp.json` → `servers` / `settings.json` → `mcp.servers` | `.github/agents/*.md` | `.github/skills/<name>/SKILL.md` | `.github/copilot-instructions.md` | project, user |
| Copilot CLI | `~/.copilot/mcp-config.json` → `mcpServers` | `~/.copilot/agents/*.md` / `.github/agents/*.md` | `skills/<name>/SKILL.md` | `.github/copilot-instructions.md` | local, project, user |
| Cline | `mcp_settings.json` → `mcpServers` | N/A | N/A | `.clinerules` | user |
| Zed | `settings.json` → `context_servers` | N/A | N/A | `.rules` | user |
| Gemini CLI | N/A | N/A | N/A | `.geminirules` | project, user |

### 3.11 Permissions Mapping

| Synctax Field | Claude Code | Copilot CLI | Cline |
|--------------|------------|-------------|-------|
| `allow` | `permissions.allow` | — | — |
| `deny` | `permissions.deny` | — | — |
| `ask` | `permissions.ask` | — | — |
| `allowedCommands` | via `permissions.allow` | — | `autoApproveCommands` |
| `networkAllow` | — | — | `autoApproveNetwork` |
| `allowedUrls` | — | `allowed_urls` | — |
| `deniedUrls` | — | `denied_urls` | — |
| `trustedFolders` | — | `trusted_folders` | — |

Notes:
- Synctax scope system: `local > project > user > global`
- `local` = personal project overrides (gitignored), `project` = committed to git
- Adapters that don't support `local` fold it into `project`
- Full research and translation guides: `docs/research/clients.md`
