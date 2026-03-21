# Product Context

## Why this project exists
Developers operate in heavily fragmented AI environments. Bouncing from Claude Code to Cursor to Zed typically requires painstakingly rewriting rules, redefining context files, and copying massive MCP config blocks. `synctax` eliminates this "sync tax".

## Problems it solves
1. **Configuration Explosion:** Maps varying proprietary locations (`.claude/settings.json`, `.vscode/settings.json`, `.config/zed/settings.json`).
2. **Configuration Drift:** Ensures rules like `CLAUDE.md` accurately mirror `.cursorrules` globally.
3. **Visibility Blindness:** The `synctax info` dashboard immediately reveals what AI capabilities are missing on what IDEs.
4. **Onboarding Friction:** Pull remote team configurations straight into the client environment safely.

## User Experience Goals
- A single master `config.json` that dictates reality.
- Visual, gorgeous CLI tables that clearly communicate drift and client state.
- Silent background operations (`watch`) that make synchronization entirely transparent to the developer.
