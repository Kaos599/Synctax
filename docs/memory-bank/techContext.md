# Tech Context

## Technologies Used
- Runtime: Node.js 20+ executing via **Bun**
- Language: TypeScript (strict mode, ESNext target, bundler module resolution)
- Testing: Vitest v4 (46 suites, 433 tests)
- Validation: Zod v4
- CLI Framework: Commander.js v14 + `@inquirer/prompts` v8 (interactive mode)
- CLI UI: Chalk v5, cli-table3 v0.6
- Fullscreen TUI: **Ink v6** (React for terminals), **React 19**, **@inkjs/ui v2** (Select, TextInput, Spinner)
- Automation: Chokidar v5 (File Watching, ESM-only)

## Development Setup
- Installed dependencies: `bun install`
- Tests: `bun run test` (runs vitest)
- Typecheck: `bun run typecheck` (runs tsc --noEmit)
- Lint: `bun run lint`
- TDD Sandbox: `tests/` create an ephemeral `os.tmpdir()` sandbox mapped to `SYNCTAX_HOME`. Every spec cleans up after itself.

## TUI Architecture
- 15 React components in `src/tui/components/` using Ink's flexbox layout (Yoga engine).
- 16 color themes with Proxy-based runtime switching (`setActiveTheme()`).
- View switching model — each mode renders a dedicated view, no overlays.
- Fullscreen alternate screen buffer for clean terminal experience.
- Theme selection persists to `~/.synctax/config.json`, CLI flag: `--theme <name>`.

## Technical Constraints
- The tool must execute perfectly handling Mac, Windows, and Linux path resolutions.
- System secrets (`credentials`) must be stripped during `profile publish` events.
- Dependencies must heavily bias towards ESM to remain modern, dictating careful import handling for packages like `chokidar` (v5+ is ESM only).
- Ink requires React and JSX — `.tsx` files use `"jsx": "react-jsx"` in tsconfig.
- `@inkjs/ui` Select component needs explicit `visibleOptionCount` for lists >5 items.
