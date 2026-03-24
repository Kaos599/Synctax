# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Synctax** — Universal Sync for the Agentic Developer Stack.

A cross-platform CLI tool that synchronizes agentic developer configuration (MCP servers, agents, skills, permissions, model preferences, prompts, memory/context files) across 9 AI-powered IDE/CLI clients from a single master config.

- **Version**: 0.1.0
- **Runtime**: Bun (TypeScript, ESM-only, `"type": "module"`)
- **Package manager**: Bun (`bun.lock`)
- **Schema validation**: Zod v4
- **CLI framework**: Commander.js v14 + `@inquirer/prompts` v8 (interactive mode)
- **Testing**: Vitest v4
- **File watching**: Chokidar v5 (ESM-only)
- **Terminal output**: Chalk v5, cli-table3 v0.6
- **TypeScript**: Strict mode, `noEmit`, bundler module resolution, ESNext target

## Common Commands

```bash
# Install dependencies
bun install

# Run CLI directly
bun ./bin/synctax.ts <command>

# Run CLI via package script
bun run synctax -- <command>

# Run all tests
bun run test                    # runs: vitest run

# Run a single test file
bunx vitest run tests/adapters.test.ts

# Run a specific test by name pattern
bunx vitest run -t "parses multiple file extensions"

# Run tests in watch mode
bunx vitest

# Type-check (no emit, strict)
bunx tsc --noEmit
```

## Directory Structure

```
bin/
  synctax.ts                    # CLI entrypoint (#!/usr/bin/env bun, Commander.js program)
src/
  commands.ts                   # All command implementations (init, sync, pull, watch, add, remove, etc.)
  interactive.ts                # Zero-arg interactive command palette (@inquirer/prompts search)
  config.ts                     # ConfigManager class: reads/writes ~/.synctax/config.json
  types.ts                      # Zod schemas (ConfigSchema, McpServerSchema, AgentSchema, etc.)
                                # TypeScript types (Config, McpServer, Agent, Skill, etc.)
                                # ClientAdapter interface definition
  scopes.ts                     # splitByScope(), toConfigScope() — partition resources by scope
  platform-paths.ts             # Cross-platform path resolution, ScopedCandidate type,
                                # homeDir(), firstExistingPath(), xdgStyleConfigCandidates(),
                                # opencodeConfigCandidates(), vscodeUserSettingsCandidates(), etc.
  banner.ts                     # ASCII art banner rendering (rebel FIGlet + pixel wordmark)
  theme.ts                      # Theme palette definitions (default, cyber, rebel, green) + paint utils
  install-path.ts               # PATH setup logic for `synctax init` (Win/macOS/Linux shell rc files)
  adapters/
    index.ts                    # Adapter registry: Record<string, ClientAdapter> + getAdapter()
    claude.ts                   # ClaudeAdapter — ~/.claude/settings.json
    cursor.ts                   # CursorAdapter — ~/.cursor/mcp.json, modes.json, commands/
    opencode.ts                 # OpenCodeAdapter — opencode.json / .opencode/config.json (scoped)
    cline.ts                    # ClineAdapter — ~/.cline/mcp_settings.json + config.json (scoped)
    antigravity.ts              # AntigravityAdapter — ~/.antigravity/config.json (scoped)
    zed.ts                      # ZedAdapter — ~/.config/zed/settings.json
    github-copilot.ts           # GithubCopilotAdapter — VS Code settings.json / mcp.json (scoped)
    github-copilot-cli.ts       # GithubCopilotCliAdapter — aliases in config.json (scoped)
    gemini-cli.ts               # GeminiCliAdapter — .gemini/settings.json (scoped)
tests/
  adapters.test.ts              # Adapter detect/read/write + scope precedence tests
  agents.test.ts                # Agent read/write across Claude, Cursor, OpenCode
  skills.test.ts                # Skill read/write across Claude (.md/.agent/.claude), Cursor (commands/), OpenCode
  commands.test.ts              # pull, move, add, remove, restore, init, doctor, profilePull/Publish
  config.test.ts                # ConfigManager read/write/getTheme
  permissions.test.ts           # Merge-conservative logic, deny-wins behavior
  profiles.test.ts              # Profile create/use/filter
  memory.test.ts                # Memory file mapping per adapter (CLAUDE.md, .cursorrules, etc.)
  new_adapters.test.ts          # Cline, Zed, GithubCopilot adapter tests
  sanity_checks.test.ts         # Sanity checks for init, move, memorySync, doctor
  export_import.test.ts         # Export/import command tests
  watch.test.ts                 # Watch daemon initialization
  theme.test.ts                 # Theme palette and paint function tests
  interactive.test.ts           # Interactive mode command dispatch (mocked @inquirer/prompts)
  ui.test.ts                    # infoCommand table output verification
  misc_domains.test.ts          # Models, Prompts, Credentials domain tests
  integration/
    e2e.test.ts                 # End-to-end: pull from Cursor → sync to OpenCode
docs/
  architecture.md               # Detailed PRD & architecture document
  changelog_and_progress.md     # Changelog and progress tracker
  instructions.md               # Project instructions
  tech_context.md               # Technology context
  index.md                      # Documentation index
  memory-bank/                  # Memory Bank context files (projectbrief, activeContext, etc.)
  research/                     # Research notes
```

## Architecture

### Core Data Flow

```
Master Config (~/.synctax/config.json)
    │
    │── sync ──→ Adapter.write() ──→ Client-specific config files
    │              (translates Synctax schema → client's proprietary format)
    │
    │── pull ──← Adapter.read() ──← Client-specific config files
    │              (translates client format → Synctax schema)
    │
    └── watch ──→ chokidar monitors config.json ──→ auto-triggers sync (500ms debounce)
```

1. **Master config** (`~/.synctax/config.json`) is the single source of truth, validated by `ConfigSchema` (Zod) in `src/types.ts`.
2. **ConfigManager** (`src/config.ts`) handles read/write/backup of master config. Path: `process.env.SYNCTAX_HOME || os.homedir()` → `.synctax/config.json`.
3. **Adapters** (`src/adapters/*.ts`) each implement the `ClientAdapter` interface. Each translates between Synctax's canonical schema and the client's proprietary config format.
4. **Commands** (`src/commands.ts`) orchestrate the flow — `syncCommand` iterates enabled clients and calls `adapter.write()`, `pullCommand` calls `adapter.read()` and merges into master.
5. **Interactive mode** (`src/interactive.ts`) launches when CLI has no args — presents a searchable command palette via `@inquirer/prompts`.

### ClientAdapter Interface (src/types.ts)

Every adapter must implement:
```typescript
interface ClientAdapter {
  id: string;
  name: string;
  detect(): Promise<boolean>;          // Does this client's config exist on disk?
  read(): Promise<{                    // Read client config → canonical format
    mcps: Record<string, McpServer>,
    agents: Record<string, Agent>,
    skills: Record<string, Skill>,
    permissions?: Permissions,
    models?: Models,
    prompts?: Prompts,
    credentials?: Credentials
  }>;
  write(resources: { ... }): Promise<void>;  // Write canonical → client config
  getMemoryFileName(): string;         // e.g. "CLAUDE.md", ".cursorrules"
  readMemory(projectDir: string): Promise<string | null>;
  writeMemory(projectDir: string, content: string): Promise<void>;
}
```

### Scope System

Resources carry a `scope` field (`global | user | project | local`). Scope precedence: `global < user < project`.

- `src/scopes.ts`: `splitByScope()` partitions resources into `{ project, user, global }` buckets before writing.
- `src/platform-paths.ts`: `ScopedCandidate { path, scope, label }` type, `firstExistingScopedPath()`, `xdgStyleConfigCandidates()`, per-client path resolution functions.
- Adapters that support multiple scopes (OpenCode, Cline, Copilot, Antigravity, Gemini CLI, Copilot CLI) read config files sorted by scope weight (global=0, user=1, project=2) so higher-precedence scopes overwrite lower ones.

### Adapter Config Locations & Key Mappings

| Client | Adapter ID | Config File(s) | MCP Key | Agent Key | Skill Key | Memory File |
|--------|-----------|----------------|---------|-----------|-----------|-------------|
| Claude Code | `claude` | `~/.claude/settings.json` | `mcpServers` | `~/.claude/agents/*.md` (frontmatter) | `~/.claude/skills/*.md` (frontmatter) | `CLAUDE.md` |
| Cursor | `cursor` | `~/.cursor/mcp.json` | `mcpServers` | `~/.cursor/modes.json` → `modes` (key: `systemPrompt`) | `~/.cursor/commands/*.md` | `.cursorrules` |
| Zed | `zed` | `~/.config/zed/settings.json` | `context_servers` | N/A | N/A | `.rules` |
| OpenCode | `opencode` | `opencode.json`, `.opencode/config.json`, `~/.config/opencode/config.json` | `mcp` | `agents` (key: `system_message`) | `skills` | `AGENTS.md` |
| Cline | `cline` | `~/.cline/mcp_settings.json`, `~/.cline/data/settings/cline_mcp_settings.json` | `mcpServers` | N/A | N/A | `.clinerules` |
| Antigravity | `antigravity` | `~/.antigravity/config.json`, `~/.config/antigravity/config.json` | `mcpServers` + `servers` | `agents` | `skills` | `.antigravityrules` |
| GitHub Copilot | `github-copilot` | VS Code `settings.json` / `mcp.json` | `mcp.servers` / `servers` | N/A | N/A | `.github/copilot-instructions.md` |
| GitHub Copilot CLI | `github-copilot-cli` | `~/.config/github-copilot-cli/config.json`, `.github/copilot/config.json` | N/A | N/A | `aliases` (skills → aliases) | `.github/copilot-instructions.md` |
| Gemini CLI | `gemini-cli` | `.gemini/settings.json`, `~/.gemini/settings.json` | N/A | N/A | N/A | `.geminirules` |

**Notable field translations:**
- Claude: `preferredModel` ↔ `models.defaultModel`, `customInstructions` ↔ `prompts.globalSystemPrompt`, `allow_paths`/`deny_paths`/`bash_allow`/`bash_deny`/`network_allow` ↔ `Permissions`
- Cursor: agents stored as "Modes" with `systemPrompt` (not `prompt`), skills stored as "Commands"
- OpenCode: agents use `system_message` (not `prompt`)
- Cline: `autoApproveNetwork` ↔ `networkAllow`, `autoApproveCommands` ↔ `allowedCommands`
- Gemini: `model` ↔ `defaultModel`, `systemInstruction` ↔ `globalSystemPrompt`
- Claude agent/skill files support extensions: `.md`, `.agent`, `.agents`, `.claude` (`.txt` and others ignored)

### Zod Schema Hierarchy (src/types.ts)

```
ConfigSchema
  ├── version: number (default: 1)
  ├── source: string?
  ├── theme: string (default: "rebel")
  ├── activeProfile: string (default: "default")
  ├── clients: Record<string, { enabled: boolean, configPath?: string }>
  ├── profiles: Record<string, ProfileSchema { include?, exclude?, extends? }>
  └── resources
       ├── mcps: Record<string, McpServerSchema { command, args?, env?, transport?, scope? }>
       ├── agents: Record<string, AgentSchema { name, description?, prompt, model?, tools?, scope? }>
       ├── skills: Record<string, SkillSchema { name, description?, trigger?, content, scope? }>
       ├── permissions: PermissionsSchema { allowedPaths, deniedPaths, allowedCommands, deniedCommands, networkAllow }
       ├── models?: ModelsSchema { defaultModel? }
       ├── prompts?: PromptsSchema { globalSystemPrompt? }
       └── credentials?: CredentialsSchema { envRefs: Record<string, string> }
```

### stripScope Helper

Every adapter uses a `stripScope<T>()` helper that removes the `scope` field before writing to client configs (clients don't understand Synctax's scope field). This is defined locally in each adapter file.

### Profile System

- Profiles contain `include` and/or `exclude` arrays of resource names.
- `applyProfileFilter()` in `commands.ts` filters resources before sync.
- `profilePublishCommand()` strips credentials from exports (security).
- `profilePullCommand()` downloads a profile from a URL via `fetch()`.

### Banner & Theme System

- Default theme: `rebel` (FIGlet block art).
- Alternate themes: `pixel`/`synctax` (custom pixel wordmark with shadow dither), `default`, `cyber`, `green`.
- `--theme <name>` flag overrides on any run.
- Theme is persisted in master config `theme` field.

### PATH Installation (src/install-path.ts)

`synctax init` optionally adds `~/.synctax/bin` to user PATH:
- **macOS/Linux**: Writes shell launcher script, appends to `.zshrc`/`.bashrc`/`.profile`/`config.fish`. On Linux also writes `~/.config/environment.d/60-synctax.conf`.
- **Windows**: Writes `synctax.cmd`, updates user PATH via PowerShell.
- Skipped automatically in tests (`process.env.VITEST`), CI, and non-TTY environments.

## Testing Conventions

### Mandatory Patterns

- **RED-Green TDD**: Every new feature, adapter, command, or bug fix must start with a failing test.
- **Sandbox isolation**: Every test file MUST:
  ```typescript
  let mockHome: string;
  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-<test-name>-"));
    process.env.SYNCTAX_HOME = mockHome;
  });
  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });
  ```
- **CWD mocking**: When testing features that use `process.cwd()` (memory files, project-scoped configs), mock or `process.chdir()` into the temp dir, and restore in `afterEach`.
- **Console suppression**: Use `vi.spyOn(console, "log").mockImplementation(() => {})` for command tests, restore in cleanup.
- **Mock adapters**: For command tests, inject mock adapters into the `adapters` registry object and clean up after.

### Gotchas

- **Chokidar v5+**: ESM-only. Cannot use `vi.spyOn` on immutable ESM namespace objects. Use `await import("chokidar")` for dynamic imports in test scenarios. The watch tests verify debounce logic via source code inspection rather than mocking.
- **ConfigManager per-call instantiation**: `commands.ts` uses `getConfigManager()` (creates new `ConfigManager()`) inside each function rather than a module-level singleton. This ensures tests that change `SYNCTAX_HOME` between runs get a fresh path.
- **Interactive mode mocking**: Tests mock `@inquirer/prompts` via `vi.mock()` at module level, then use `vi.mocked(search).mockResolvedValue(...)`.

### Test Organization

Tests are organized by domain:
- `adapters.test.ts` — adapter detect/read/write, scope precedence
- `agents.test.ts` — agent domain across adapters
- `skills.test.ts` — skill domain across adapters
- `commands.test.ts` — CLI command behavior
- `permissions.test.ts` — merge-conservative security logic
- `profiles.test.ts` — profile create/use/filter
- `memory.test.ts` — memory file per-adapter mapping
- `integration/e2e.test.ts` — end-to-end pull→sync across clients

## Code Style & Conventions

### TypeScript

- **Strict mode** enabled: `strict: true`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `noImplicitOverride`
- `noUnusedLocals` and `noUnusedParameters` are **disabled** (intentional)
- All imports use `.js` extensions (ESM bundler resolution): `import { Foo } from "./bar.js"`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- No build step — Bun runs `.ts` files directly

### Code Patterns

- Adapters use private getters for computed paths: `private get baseDir()`, `private get configPath()`
- Every adapter reads existing config before writing (merge, not overwrite): `let existing = {}; try { existing = JSON.parse(...) } catch {}`
- `fs.mkdir(dir, { recursive: true }).catch(() => {})` used everywhere for idempotent directory creation
- YAML frontmatter parsing in Claude adapter is manual (`content.split("---")`) — not a library
- `Object.entries<any>()` used extensively for JSON parsing where types are unknown
- Error handling pattern: catch `error.code === "ENOENT"` for missing files, rethrow others

### Naming

- Adapter classes: `PascalCase` + `Adapter` suffix (e.g. `ClaudeAdapter`, `GeminiCliAdapter`)
- Adapter IDs: kebab-case strings (e.g. `"github-copilot-cli"`)
- Test file tmpdir prefixes: `"synctax-<domain>-test-"` or `"synctax-<domain>-"`
- Exported command functions: `<name>Command` (e.g. `syncCommand`, `pullCommand`, `initCommand`)

## Domain Terminology

| Term | Meaning |
|------|---------|
| **Master config** | `~/.synctax/config.json` — the single source of truth |
| **Adapter** | Translation layer in `src/adapters/` bridging Synctax schema to a client's config format |
| **MCP** | Model Context Protocol server (command + args + env) |
| **Resource** | Any synced entity: MCP, Agent, Skill, Permission, Model, Prompt, or Credential |
| **Scope** | Where a resource lives: `global`, `user`, `project`, or `local` |
| **Memory file** | Per-client context file in project root (e.g. `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.rules`) |
| **Profile** | Named filter (include/exclude lists) applied before sync |
| **Merge-conservative** | Security principle: deny lists always override allow lists |
| **Source** | The client designated as "source of truth" (set during init or pull) |
| **Daemon** | The chokidar-powered background sync runner (`synctax watch`) |

## Key Architectural Decisions

1. **Merge-conservative security**: `mergePermissions()` in `commands.ts` — when merging permission sets, deny always wins. If a path/command is in both allowed and denied, it is removed from allowed. `networkAllow` uses AND logic (both must be true). This prevents accidental permissive leaks during profile pulls.

2. **Zod `.default({})` on resource maps**: All optional resource records use `.default({})` so `Object.keys()` iterations never operate on `undefined`.

3. **`getConfigManager()` factory per call**: `commands.ts` creates a new `ConfigManager()` inside each function (not module-level) so `SYNCTAX_HOME` changes in tests propagate correctly.

4. **Scope-aware write routing**: Multi-scope adapters (OpenCode, Cline, Antigravity, Copilot, Copilot CLI) use `splitByScope()` to partition resources, then write project-scoped resources to workspace paths and user/global to home paths.

5. **Credential stripping on publish**: `profilePublishCommand()` explicitly excludes `credentials` from the export payload. Credentials only exist in the local master config.

6. **Frontmatter parsing for Claude agents/skills**: Manual `split("---")` parsing — no YAML library dependency. Supports `name`, `description`, `model`, `trigger` fields in YAML frontmatter.

7. **PATH installation is opt-in**: `maybePromptAndInstallPath()` checks `process.env.VITEST`, `process.env.CI`, and `stdin.isTTY` before prompting. Tests and CI never trigger PATH modification.

8. **Read-before-write in all adapters**: Every adapter reads existing config before writing, preserving fields Synctax doesn't manage. Pattern: parse existing JSON → overlay Synctax-managed fields → write back.

## Git Conventions

- No git repo is currently initialized in this directory.
- The `.gitignore` covers Python, Node, and common IDE artifacts. `node_modules/` is ignored.
- `.vscode/`, `.cursor/`, and `.opencode/` directories are tracked (contain project config).

## Adding a New Adapter

1. Create `src/adapters/<client-name>.ts` implementing `ClientAdapter`
2. Define a `stripScope()` helper (standard pattern across all adapters)
3. Use `homeDir()` from `platform-paths.ts` for path resolution (respects `SYNCTAX_HOME`)
4. For multi-scope clients, use `ScopedCandidate[]` + `splitByScope()` pattern
5. Register in `src/adapters/index.ts` with a kebab-case ID
6. Add tests in `tests/` following the sandbox pattern
7. Update the scope matrix in docs if applicable
