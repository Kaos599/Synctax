# Phase 6: Deferred / Future

**Status**: Backlog
**These items are tracked but not scheduled. They will be fleshed out when prioritized.**

## New Client Adapters

### OpenAI Codex CLI
- Config: `~/.codex/config.toml` (TOML — first non-JSON adapter)
- Instructions: `AGENTS.md` (shared with OpenCode)
- MCP key: `mcp_servers`
- Requires: TOML parser dependency (e.g., `smol-toml`)
- Effort: Medium (adapter + TOML parsing infrastructure)

### Windsurf (Codeium)
- VS Code-based, config similar to GitHub Copilot
- MCP config in VS Code settings format
- Effort: Small (similar to existing Copilot adapter)

### Aider
- Config: `~/.aider.conf.yml` (YAML)
- Terminal-based AI pair programmer
- Requires: YAML parser dependency
- Effort: Medium

### Continue.dev
- Config: `~/.continue/config.json`
- Open-source AI assistant for VS Code/JetBrains
- Effort: Small (JSON, similar to existing adapters)

### Amazon Q Developer
- Config: VS Code settings or standalone
- Effort: Small-Medium (needs research on config format)

### JetBrains AI Assistant
- Config: IDE-specific settings
- Effort: Medium (needs JetBrains plugin system understanding)

### Kilo Code
- Fork of Cline with different config paths
- Effort: Small (fork existing Cline adapter)

## Infrastructure Features

### Per-Project Auto-Switching
- `.synctaxrc` file in project root declares which profile to activate
- Shell hook (zsh/bash/fish) auto-switches on `cd`
- Similar to: `.nvmrc` (nvm), `.envrc` (direnv), `.aiswitch` (aiswitch)
- Effort: Medium (shell hook installation, rc file detection)

### Watch Daemon Safety
- Mutex/lock file to prevent concurrent syncs
- Graceful handling of config.json deletion during watch
- Configurable debounce interval
- Effort: Small

### Deletion Tracking During Pull
- When pulling from a client that has fewer resources than master, detect which were removed
- Option: `--prune` to also remove from master what's missing from client
- Effort: Small

### Audit Trail / Changelog
- JSON log file tracking when/why configs changed
- `synctax log` command to view history
- Entries: timestamp, action (sync/pull/add/remove), resources affected, profile
- Effort: Medium

### Profile Composition
- `extends` field in ProfileSchema (already in Zod schema, unused)
- Profile "work-frontend" extends "work" with additional frontend MCPs
- Inheritance chains: work → work-frontend → work-frontend-react
- Effort: Medium

## Advanced Features

### AI-Assisted Conflict Resolution
- When two clients have divergent configs, use an LLM to propose resolution
- Requires: API integration, prompt engineering
- Effort: Large

### Rich TUI (lazygit-style)
- Full terminal UI with panels, keyboard navigation, mouse support
- Uses: Ink (React for CLI) or blessed
- Effort: Large

### Web Dashboard
- Local web UI at localhost:3000
- Visual config management, drag-and-drop, real-time sync status
- `synctax ui` command
- Effort: Very Large

## Research Items

### AGENTS.md Standard Convergence
- The Agentic AI Foundation (under Linux Foundation) stewards AGENTS.md
- Read natively by: Cursor, Copilot, Codex, Antigravity
- NOT read by Claude Code (uses CLAUDE.md)
- Monitor: Will Anthropic add native AGENTS.md support?
- Impact: If convergence happens, `synctax link` becomes even more powerful

### MCP Spec Configuration Portability
- RFC #2219 filed on MCP spec repo requesting standardized config format
- 2026 roadmap lists "configuration portability" as a priority
- Monitor: If the spec standardizes config, adapter complexity drops significantly
- Impact: Could simplify adapter layer from format translation to simple copy

### Hosted MCP Gateways
- Docker MCP Toolkit, Mozilla mcpd-proxy, Mantra
- Moving toward hosted servers that eliminate the sync problem entirely
- Synctax should support both local stdio MCPs AND gateway URLs
- Impact: Future adapters may need `transport: "http"` support
