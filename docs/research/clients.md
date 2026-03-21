# Client Configuration Research

## Existing Implementations (from PRD & logic)
- **Claude Code**: `~/.claude/settings.json`, agents in `~/.claude/agents/`, skills in `~/.claude/skills/`, memory in `CLAUDE.md`.
- **Cursor**: `.cursor/mcp.json` or `~/.cursor/mcp.json`, agents in `.cursor/modes.json`, commands in `.cursor/commands/`, memory in `.cursorrules`.
- **OpenCode**: `~/.config/opencode/config.json`, memory in `AGENTS.md`.
- **Antigravity**: `~/.config/antigravity/config.json`, memory in `.antigravityrules`.

## To Implement

### 5. Cline
- Mentioned in PRD: `~/.cline/mcp_settings.json` for MCPs, `~/.cline/agents/` for agents, `~/.cline/config.json` for auto-approve settings, `.clinerules` for memory files.

### 6. Github Copilot (VS Code)
- Copilot Custom Instructions often go in `.github/copilot-instructions.md`.
- Workspace settings for Copilot (mcp.servers) usually go in `.vscode/settings.json` or User settings.json (`~/Library/Application Support/Code/User/settings.json` on Mac, `~/.config/Code/User/settings.json` on Linux, etc.).

### 7. Github Copilot CLI
- Context/instructions might be `.github/copilot-instructions.md` as well. Need a dedicated adapter to sync its settings (often lives in `~/.config/github-copilot-cli/` or managed via `gh` cli config `~/.config/gh/config.yml`).

### 8. Gemini CLI
- Typically `~/.config/gemini/` or similar. Need to define an adapter for it.

### 9. Zed
- Mentioned in PRD: `~/.config/zed/settings.json` under `context_servers`. Memory files in `.rules` or `.zed/rules`.
