# Client Configuration Research — Deep Dive (March 2026)

**Research date**: 2026-03-25
**Sources consulted**: 80+ (official docs, GitHub repos, Exa, Tavily, Context7)
**Purpose**: Ground truth for adapter correctness. Every table below reflects the **real** client config format as of March 2026, not what the Synctax adapter currently implements.

---

## Research Summary: Adapter Correctness Status

| Adapter | Severity | Status | Key Issues Found |
|---------|----------|--------|------------------|
| Claude Code | CRITICAL | Needs rewrite | MCPs in wrong file, permissions schema wrong, model/prompt fields wrong, frontmatter incomplete |
| OpenCode | CRITICAL | Needs rewrite | MCP command is array not string, `env` → `environment`, agent key singular not plural |
| Antigravity | CRITICAL | Needs rewrite | Config path wrong, agents/skills file-based not JSON, memory file name wrong |
| Copilot CLI | CRITICAL | Needs rewrite | Config path retired, `aliases` retired → SKILL.md, MCPs not supported |
| Cursor | MODERATE | Needs update | SKILL.md support added, rules format changed, commands have no frontmatter |
| Copilot VS Code | MODERATE | Needs update | Missing remote servers, agent files, skill files |
| Cline | OK | Minor gaps | Permissions mapping mostly correct |
| Zed | OK | Correct | MCP key `context_servers` verified |
| Gemini CLI | OK | Minor gaps | Model/prompt mapping correct |

---

## 1. Claude Code (Anthropic)

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| User MCP definitions | `~/.claude.json` | MCP server definitions (NOT in settings.json) |
| Project MCP definitions | `.mcp.json` (project root) | Project-scoped MCP servers |
| User settings | `~/.claude/settings.json` | Permissions, model, MCP policies, hooks |
| Project settings | `.claude/settings.json` | Project-level settings (committed to git) |
| Local settings | `.claude/settings.local.json` | Personal project overrides (gitignored) |
| Managed settings | `~/.claude/settings.managed.json` | Organization-managed (highest precedence) |
| Agents | `~/.claude/agents/*.md` | Global agents |
| Agents (project) | `.claude/agents/*.md` | Project agents |
| Skills | `~/.claude/skills/<name>/SKILL.md` | Directory-based skills |
| Memory | `CLAUDE.md` (project root) | Project instructions |
| Memory (global) | `~/.claude/CLAUDE.md` | Global instructions |
| Memory (local) | `CLAUDE.local.md` | Personal project instructions (gitignored) |

### Settings Precedence (highest → lowest)
```
Managed > CLI args > Local > Project > User
```

### MCP Server Format (in .mcp.json / ~/.claude.json)
```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "server-package"],
      "env": { "KEY": "${ENV_VAR}" },
      "cwd": "/optional/dir"
    },
    "remote-server": {
      "type": "http",
      "url": "https://mcp.example.com",
      "headers": { "Authorization": "Bearer ${TOKEN}" }
    }
  }
}
```

**Transport types**: `stdio`, `http`, `sse`, `ws`
**Env interpolation**: `${VAR}` syntax

### MCP Policies (in settings.json — NOT definitions)
```json
{
  "enableAllProjectMcpServers": false,
  "enabledMcpjsonServers": ["server-a", "server-b"],
  "deniedMcpServers": ["untrusted-server"]
}
```

### Permissions Format (CURRENT — replaces old format)
```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Read(~/docs/**)", "Write(src/**)"],
    "deny": ["Bash(curl *)", "Read(.env)", "Bash(rm -rf *)"],
    "ask": ["Bash(git push *)", "Write(package.json)"]
  }
}
```

**Evaluation order**: deny > ask > allow
**OLD format (DEPRECATED)**: `allow_paths`, `deny_paths`, `bash_allow`, `bash_deny`, `network_allow` — these no longer exist.

### Model Configuration
```json
{
  "model": "claude-sonnet-4-20250514"
}
```
**Aliases**: `default`, `sonnet`, `opus`, `haiku`, `opusplan`, `sonnet[1m]`, `opus[1m]`
**Effort levels**: `low`, `medium`, `high`, `max` (session-only, Opus 4.6)
**OLD field (DEPRECATED)**: `preferredModel` no longer exists.
**Instructions**: NOT in settings.json — instructions go in `CLAUDE.md` files.

### Agent Frontmatter Fields (14 total)
```yaml
---
name: My Agent
description: What this agent does
model: claude-sonnet-4-20250514
tools: [Read, Write, Bash, Grep, Glob]
disallowedTools: [WebFetch]
permissionMode: bypassPermissions
maxTurns: 10
skills: [my-skill]
mcpServers: [postgres, redis]
hooks:
  preToolUse: echo "about to use tool"
memory: [memory.md]
background: false
effort: high
isolation: true
---

Agent prompt content here...
```

### Skill Format (Directory-based)
```
~/.claude/skills/<skill-name>/SKILL.md
```

```yaml
---
name: my-skill
description: What this skill does
argument-hint: "<file-path>"
disable-model-invocation: false
user-invocable: true
allowed-tools: [Read, Write, Bash]
model: claude-sonnet-4-20250514
effort: medium
context: [src/types.ts]
agent: reviewer
hooks:
  onActivate: echo "activated"
---

Skill instructions here...
```

### Hooks System
21 lifecycle events including: `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, `PermissionRequest`, `SubagentStart`, `SubagentStop`, `ConfigChange`, `PreCompact`, `PostCompact`, `Elicitation`, and more. Supports `command`, `http`, `prompt`, and `agent` handler types.

### What Synctax Adapter Currently Does WRONG
1. Reads/writes MCPs to `settings.json` → should be `.mcp.json` / `~/.claude.json`
2. Uses `allow_paths`/`deny_paths`/`bash_allow`/`bash_deny` → should be `permissions.allow/deny/ask`
3. Uses `preferredModel` → should be `model`
4. Uses `customInstructions` → does not exist, instructions are in CLAUDE.md
5. Only parses 3 frontmatter fields → should parse 14 (agents) / 11 (skills)
6. Reads skills as flat files → should read directory-based `skills/<name>/SKILL.md`
7. Single scope (user only) → should support user + project + local

---

## 2. Cursor

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| Global MCPs | `~/.cursor/mcp.json` | User-level MCP servers |
| Project MCPs | `.cursor/mcp.json` (project root) | Project-scoped MCP servers |
| Modes | `~/.cursor/modes.json` | Custom modes (uncertain — may be cloud-managed) |
| Commands | `~/.cursor/commands/*.md` | Global slash commands |
| Commands (project) | `.cursor/commands/*.md` | Project slash commands |
| Skills | `~/.cursor/skills/<name>/SKILL.md` | Global skills (Cursor 2.4+) |
| Skills (project) | `.cursor/skills/<name>/SKILL.md` | Project skills |
| Rules | `.cursor/rules/*.mdc` | Project rules with frontmatter |
| Rules (legacy) | `.cursorrules` (project root) | Legacy rules file (deprecated) |
| Memory | `.cursorrules` (project root) | Memory/instructions |

### MCP Server Format
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "server-package"],
      "env": { "KEY": "value" },
      "envFile": ".env",
      "disabled": false
    },
    "remote-server": {
      "url": "https://mcp.example.com",
      "headers": { "Authorization": "Bearer token" }
    }
  }
}
```

**Config interpolation**: `${env:NAME}`, `${userHome}`, `${workspaceFolder}`
**Transport**: stdio, SSE, Streamable HTTP (v0.50+)
**Tool limit**: ~40 active tools across all servers

### Modes (Agents)
Custom modes introduced in v0.48.x. Configuration may be cloud/UI managed, not reliably in local files. The `modes.json` format is **unverified**.

### Commands (Skills — Legacy)
Plain markdown files. **No frontmatter**. Filename = command name. Entire file content = prompt.
```
~/.cursor/commands/my-command.md   → invoked as /my-command
```

### Skills (SKILL.md — New, v2.4+)
```yaml
---
name: my-skill
description: What this skill does
disable-model-invocation: false
---

Skill instructions...
```

Also reads skills from `.agents/skills/`, `.claude/skills/`, `.codex/skills/`.

### Rules (.cursor/rules/*.mdc)
```yaml
---
description: TypeScript coding standards
globs: "**/*.ts,**/*.tsx"
alwaysApply: false
---

Rule content here...
```

**4 activation modes**: Always Apply, Auto-Attached (globs), Agent-Requested (description), Manual (@-mention)

Also reads `AGENTS.md` and `CLAUDE.md` from project root.

### What Synctax Adapter Currently Does WRONG
1. No project-scope MCP reading (only `~/.cursor/mcp.json`)
2. Skills stored as commands with frontmatter → commands are plain markdown, no frontmatter
3. Missing SKILL.md support entirely (Cursor 2.4+)
4. Rules system not captured

---

## 3. OpenCode

### Config File Locations (Precedence: later overrides earlier)

| Scope | File | Purpose |
|-------|------|---------|
| Global | `~/.config/opencode/opencode.json` | System-wide config |
| Custom | `OPENCODE_CONFIG` env var | Custom path |
| Project | `opencode.json` (project root) | Project config |
| Agents | `.opencode/agents/*.md` | File-based agents |
| Skills | `.opencode/skills/<name>/SKILL.md` | File-based skills |
| Memory | `AGENTS.md` (project root) | Instructions (also reads `CLAUDE.md`) |

### MCP Server Format — NON-STANDARD
```json
{
  "mcp": {
    "server-name": {
      "type": "local",
      "command": ["npx", "-y", "my-server"],
      "environment": {},
      "enabled": true,
      "timeout": 5000
    },
    "remote-server": {
      "type": "remote",
      "url": "https://example.com/mcp",
      "headers": {},
      "oauth": {},
      "enabled": true
    }
  }
}
```

**Key differences from standard format:**
- Top-level key is `mcp` (NOT `mcpServers`)
- `command` is an **ARRAY** (combines command + args into one array)
- Field is `environment` (NOT `env`)
- `type` field is required: `"local"` or `"remote"`

### Agent Format — JSON Config
```json
{
  "agent": {
    "agent-name": {
      "name": "Agent Name",
      "prompt": "System prompt here",
      "model": "model-name"
    }
  }
}
```

**Key**: `agent` (SINGULAR, not `agents`)
**Prompt field**: `prompt` (NOT `system_message`)

### Skills — File-Based ONLY
Skills use SKILL.md standard, NOT JSON configuration. Searched in:
`.opencode/skills/`, `~/.config/opencode/skills/`, `.claude/skills/`, `.agents/skills/`

### What Synctax Adapter Currently Does WRONG
1. Treats MCP `command` as string → should be array
2. Uses `env` key → should be `environment`
3. Missing `type: "local"/"remote"` field
4. Uses `agents` (plural) → should be `agent` (singular)
5. Uses `system_message` → should be `prompt`
6. Skills are JSON-based → should be file-based SKILL.md

---

## 4. Antigravity (Google)

### What It Actually Is
Antigravity is Google's **agentic IDE** (VS Code fork), NOT a CLI tool. Has a GUI Agent Manager "Mission Control" dashboard.

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| MCP config | `~/.gemini/antigravity/mcp_config.json` | MCP server definitions |
| Workspace rules | `.agent/rules/*.md` | Project rules |
| Workspace workflows | `.agent/workflows/*.md` | Saved prompts (triggered via `/`) |
| Skills | `.agents/skills/<name>/SKILL.md` | Project skills |
| Skills (global) | `~/.gemini/antigravity/skills/<name>/SKILL.md` | Global skills |
| Memory | `GEMINI.md` (primary) or `AGENTS.md` (fallback) | Instructions |

### MCP Server Format (Standard)
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "my-server"],
      "env": { "KEY": "value" }
    }
  }
}
```

### Agents — File-Based
No JSON-based agent definitions. Agents configured through:
- `GEMINI.md` (Antigravity-native rules)
- `AGENTS.md` (cross-tool rules, v1.20.3+)
- `.agent/rules/*.md` (workspace rules)
- `.agent/workflows/*.md` (saved prompts)

**Precedence**: AGENTS.md > GEMINI.md > Built-in defaults

### What Synctax Adapter Currently Does WRONG
1. Config paths (`~/.antigravity/config.json`) → should be `~/.gemini/antigravity/mcp_config.json`
2. Agents as JSON → should be file-based (GEMINI.md, .agent/rules/*.md)
3. Skills as JSON → should be file-based SKILL.md
4. Memory file `.antigravityrules` → should be `GEMINI.md` or `AGENTS.md`

---

## 5. GitHub Copilot (VS Code Extension)

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| Workspace MCPs | `.vscode/mcp.json` | Project MCP servers (shared via git) |
| User MCPs | VS Code `settings.json` → `mcp.servers` | User-level MCPs |
| Instructions | `.github/copilot-instructions.md` | Repository-wide instructions |
| Path instructions | `.github/instructions/**/*.instructions.md` | Path-specific (with `applyTo` glob) |
| Agents | `.github/agents/*.md` | Custom agents with frontmatter |
| Skills | `.github/skills/<name>/SKILL.md` | Skills (open standard) |
| Memory | `.github/copilot-instructions.md` | Instructions file |

### MCP Format in `.vscode/mcp.json`
```json
{
  "inputs": [
    { "type": "promptString", "id": "api-key", "description": "API Key", "password": true }
  ],
  "servers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "server"],
      "env": { "KEY": "${input:api-key}" }
    },
    "remote": {
      "url": "https://mcp.example.com",
      "type": "http",
      "requestInit": { "headers": { "Authorization": "Bearer token" } }
    }
  }
}
```

### MCP Format in `settings.json`
```json
{
  "mcp.servers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "server"]
    }
  }
}
```

### Agent Frontmatter
```yaml
---
name: My Agent
description: Required field
tools: [execute, read, edit, search]
model: gpt-4o
user-invocable: true
mcp-servers:
  postgres:
    command: npx
---

Agent instructions...
```

### Path-Specific Instructions
```yaml
---
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript standards here...
```

### What Synctax Adapter Currently Does WRONG
1. Missing remote server support (url, requestInit.headers)
2. Missing agent file support (.github/agents/)
3. Missing skill file support (.github/skills/)
4. Missing path-specific instructions

---

## 6. GitHub Copilot CLI (Standalone)

### CRITICAL: The `gh copilot` Extension is RETIRED
Replaced by standalone `copilot` binary. Config directory: `~/.copilot/`

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| User config | `~/.copilot/config.json` | Model, theme, permissions |
| User MCPs | `~/.copilot/mcp-config.json` | MCP server definitions |
| Project settings | `.github/copilot/settings.json` | Project config (committed) |
| Local overrides | `.github/copilot/settings.local.json` | Personal overrides (gitignored) |
| Agents | `~/.copilot/agents/*.md` or `.github/agents/*.md` | Agent definitions |
| Skills | `~/.copilot/skills/<name>/SKILL.md` or `.github/skills/*.md` | Skills |
| Memory | `.github/copilot-instructions.md` | Instructions |
| Personal instructions | `~/.copilot/copilot-instructions.md` | Personal global instructions |

### MCP Format (in mcp-config.json)
```json
{
  "mcpServers": {
    "server-name": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "server"],
      "tools": ["*"],
      "env": { "KEY": "$ENV_VAR" },
      "cwd": "/optional/dir",
      "timeout": 30000
    }
  }
}
```

**Key differences from VS Code**: `mcpServers` (not `servers`), `tools` required, `cwd` supported.

### Config.json Fields
```json
{
  "allowed_urls": ["https://api.example.com"],
  "denied_urls": ["http://evil.com"],
  "model": "gpt-4o",
  "theme": "auto",
  "trusted_folders": ["/Users/me/projects"],
  "reasoning_effort": "medium",
  "banner": "once",
  "auto_update": true,
  "include_coauthor": true
}
```

### Settings Cascade
CLI flags > env vars > repo settings > user config

### What Synctax Adapter Currently Does WRONG
1. Config path `~/.config/github-copilot-cli/` → should be `~/.copilot/`
2. Uses `aliases` for skills → aliases retired, replaced by SKILL.md
3. No MCP support → should read `~/.copilot/mcp-config.json`
4. No agent support → should read `~/.copilot/agents/`
5. No permission mapping → `allowed_urls`/`denied_urls`/`trusted_folders`

---

## 7. Cline

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| MCP (legacy) | `~/.cline/mcp_settings.json` | MCP servers |
| MCP (current) | `~/.cline/data/settings/cline_mcp_settings.json` | MCP servers |
| Config | `~/.cline/config.json` | Permissions, model |
| Memory | `.clinerules` (project root) | Instructions |

### MCP Format (Standard)
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "server"],
      "env": { "KEY": "value" }
    }
  }
}
```

### Permissions Mapping
- `autoApproveNetwork` ↔ `networkAllow`
- `autoApproveCommands` ↔ `allowedCommands`
- `model` ↔ `defaultModel`

**Status**: Adapter is mostly correct. Minor gaps only.

---

## 8. Zed

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| User config | `~/.config/zed/settings.json` | Settings including MCPs |
| Memory | `.rules` (project root) | Instructions |

### MCP Format
```json
{
  "context_servers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "server"],
      "env": { "KEY": "value" }
    }
  }
}
```

**Status**: Adapter is correct. No agents/skills support (Zed doesn't have them).

---

## 9. Gemini CLI

### Config File Locations

| Scope | File | Purpose |
|-------|------|---------|
| Project | `.gemini/settings.json` | Project settings |
| User | `~/.gemini/settings.json` | User settings |
| Legacy | `~/.gemini/config.json`, `~/.config/gemini/config.json` | Fallbacks |
| Memory | `.geminirules` (project root) | Instructions |

### Key Mappings
- `model` ↔ `defaultModel`
- `systemInstruction` ↔ `globalSystemPrompt`

**Status**: Adapter is mostly correct. No MCPs, agents, or skills (Gemini CLI doesn't support them).

---

## Scope System: Per-Client Mapping (v2 — Updated)

| Synctax Scope | Claude Code | Cursor | OpenCode | Copilot VS Code | Copilot CLI | Antigravity | Cline | Zed | Gemini CLI |
|---------------|-------------|--------|----------|-----------------|-------------|-------------|-------|-----|-----------|
| **local** | `.claude/settings.local.json` | — | — | — | `.github/copilot/settings.local.json` | — | — | — | — |
| **project** | `.mcp.json` + `.claude/settings.json` | `.cursor/mcp.json` | `opencode.json` | `.vscode/mcp.json` | `.github/copilot/settings.json` | `.agent/` | — | — | `.gemini/settings.json` |
| **user** | `~/.claude.json` + `~/.claude/settings.json` | `~/.cursor/mcp.json` | `.opencode/config.json` | VS Code user settings | `~/.copilot/config.json` | `~/.gemini/antigravity/` | `~/.cline/` | `~/.config/zed/settings.json` | `~/.gemini/settings.json` |
| **global** | (same as user) | (same as user) | `~/.config/opencode/config.json` | (same as user) | (same as user) | (same as user) | (same as user) | (same as user) | (same as user) |

---

## Resource Support Matrix (v2 — Updated)

| Client | MCPs | Agents | Skills | Permissions | Models | Prompts | Memory |
|--------|------|--------|--------|-------------|--------|---------|--------|
| Claude Code | `.mcp.json` / `~/.claude.json` | `agents/*.md` (14 frontmatter fields) | `skills/<name>/SKILL.md` (11 fields) | `permissions.allow/deny/ask` | `model` in settings | CLAUDE.md | CLAUDE.md |
| Cursor | `mcp.json` → `mcpServers` | Modes (cloud-managed?) | `commands/*.md` + `skills/<name>/SKILL.md` | Limited (YOLO mode) | — | — | `.cursorrules` |
| OpenCode | `mcp` → array `command` | `agent` (singular) → `prompt` | `skills/<name>/SKILL.md` | — | — | — | `AGENTS.md` |
| Antigravity | `mcp_config.json` → `mcpServers` | `GEMINI.md` + `.agent/rules/*.md` | `.agents/skills/<name>/SKILL.md` | — | — | — | `GEMINI.md` |
| Copilot VS Code | `mcp.json` → `servers` / `settings.json` → `mcp.servers` | `.github/agents/*.md` | `.github/skills/<name>/SKILL.md` | — | — | — | `.github/copilot-instructions.md` |
| Copilot CLI | `mcp-config.json` → `mcpServers` | `agents/*.md` | `skills/<name>/SKILL.md` | `allowed_urls`/`denied_urls` | `model` | — | `.github/copilot-instructions.md` |
| Cline | `mcp_settings.json` → `mcpServers` | — | — | `autoApproveNetwork`/`autoApproveCommands` | `model` | — | `.clinerules` |
| Zed | `settings.json` → `context_servers` | — | — | — | — | — | `.rules` |
| Gemini CLI | — | — | — | — | `model` | `systemInstruction` | `.geminirules` |

---

## Frontmatter Field Compatibility Matrix

### Agent Frontmatter

| Field | Claude Code | Cursor Modes | OpenCode | Copilot | Antigravity |
|-------|------------|-------------|----------|---------|-------------|
| `name` | ✓ | ✓ (mode name) | ✓ | ✓ | via GEMINI.md |
| `description` | ✓ | ✓ | ✓ | ✓ (required) | — |
| `prompt` | body content | `systemPrompt` | `prompt` | body content | body content |
| `model` | ✓ | ✓ | ✓ | ✓ | — |
| `tools` | ✓ (14 fields) | ✓ (tool list) | — | ✓ (aliases) | — |
| `disallowedTools` | ✓ | — | — | — | — |
| `permissionMode` | ✓ | — | — | — | — |
| `maxTurns` | ✓ | — | — | — | — |
| `mcpServers` | ✓ | — | — | ✓ | — |
| `hooks` | ✓ | — | — | — | — |
| `background` | ✓ | — | — | — | — |
| `effort` | ✓ | — | — | — | — |
| `isolation` | ✓ | — | — | — | — |
| `userInvocable` | ✓ | — | — | ✓ | — |

### Skill Frontmatter

| Field | Claude Code | Cursor | OpenCode | Copilot | Antigravity |
|-------|------------|--------|----------|---------|-------------|
| `name` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `description` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `trigger` | — | `/filename` | — | `/skill-name` | `/workflow` |
| `content` | body | body | body | body | body |
| `argument-hint` | ✓ | — | — | — | — |
| `disable-model-invocation` | ✓ | ✓ | — | ✓ | — |
| `user-invocable` | ✓ | — | — | ✓ | — |
| `allowed-tools` | ✓ | — | — | ✓ | — |
| `model` | ✓ | — | — | — | — |
| `effort` | ✓ | — | — | — | — |
| `context` | ✓ | — | — | — | — |

---

## MCP Format Translation Guide

This table shows how to translate Synctax's canonical MCP format to each client:

| Synctax Field | Claude Code | Cursor | OpenCode | Copilot VS Code | Copilot CLI | Cline | Zed | Antigravity |
|--------------|------------|--------|----------|-----------------|-------------|-------|-----|-------------|
| `command` | `command` | `command` | `command[0]` (array) | `command` | `command` | `command` | `command` | `command` |
| `args` | `args` | `args` | `command[1:]` (merged) | `args` | `args` | `args` | `args` | `args` |
| `env` | `env` | `env` | `environment` | `env` | `env` | `env` | `env` | `env` |
| `transport` | `type` | inferred | `type` ("local"/"remote") | `type` | `type` ("local") | — | — | — |
| `url` | `url` | `url` | `url` | `url` | — | — | — | — |
| `headers` | `headers` | `headers` | `headers` | `requestInit.headers` | — | — | — | — |
| `scope` | stripped | stripped | stripped | stripped | stripped | stripped | stripped | stripped |
| `disabled` | — | `disabled` | `enabled` (inverted) | — | — | — | — | — |
| `timeout` | — | — | `timeout` | — | `timeout` | — | — | — |
| `cwd` | `cwd` | — | — | — | `cwd` | — | — | — |

---

## Permissions Translation Guide

| Synctax Field | Claude Code | Copilot CLI | Cline |
|--------------|------------|-------------|-------|
| `allow` | `permissions.allow` (Tool(specifier) syntax) | — | — |
| `deny` | `permissions.deny` | — | — |
| `ask` | `permissions.ask` | — | — |
| `allowedPaths` | parsed from `permissions.allow` | — | — |
| `deniedPaths` | parsed from `permissions.deny` | — | — |
| `allowedCommands` | parsed from `permissions.allow` | — | `autoApproveCommands` |
| `deniedCommands` | parsed from `permissions.deny` | — | — |
| `networkAllow` | — | — | `autoApproveNetwork` |
| `allowedUrls` | — | `allowed_urls` | — |
| `deniedUrls` | — | `denied_urls` | — |
| `trustedFolders` | — | `trusted_folders` | — |
