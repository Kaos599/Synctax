# Tech Context

## Technologies Used
- Runtime: Node.js 20+ executing via **Bun**
- Language: TypeScript
- Testing: Vitest
- Validation: Zod
- CLI UI: Commander.js, Chalk, cli-table3
- Automation: Chokidar (File Watching)

## Development Setup
- Installed dependencies: `bun add commander chalk zod chokidar cli-table3`
- Tests run extremely quickly via `bun run test`.
- TDD Sandbox: `tests/` create an ephemeral `os.tmpdir()` sandbox mapped to `SYNCTAX_HOME`. Every spec cleans up after itself.

## Technical Constraints
- The tool must execute perfectly handling Mac, Windows, and Linux path resolutions.
- System secrets (`credentials`) must be stripped during `profile publish` events.
- Dependencies must heavily bias towards ESM to remain modern, dictating careful import handling for packages like `chokidar` (v5+ is ESM only).
