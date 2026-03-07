# Active Context

## Current Work Focus
We are transitioning out of the v1.0-GA milestone and entering the client-expansion phase. The focus is to expand the existing four clients (Claude Code, Cursor, OpenCode, Antigravity) to properly support Github Copilot, Github Copilot CLI, Cline, Gemini CLI, and Zed.

## Recent Changes
- Implemented core domains: MCPs, Agents, Memory, Profiles, Skills, Permissions, Models, Prompts, Credentials.
- Built CLI commands: `add`, `remove`, `restore`, `doctor`, `profile pull`, `profile publish`.
- Fixed data dropping on Profile filtering.

## Next Steps
- Use web searches to uncover exact schemas and storage locations for remaining AI clients.
- Build TDD Client Adapters for the discovered schemas.
