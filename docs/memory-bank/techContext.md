# Tech Context

## Technologies Used
- Runtime: Node.js 20+ via **Bun**
- Language: TypeScript
- Testing: Vitest
- Validation: Zod
- CLI UI: Commander.js, Chalk

## Development Setup
- Project is initialized via `bun init`. Tests are run using `bun run test`.
- Filesystem mocks utilize temporary directories hooked via the `SYNCTAX_HOME` environment variable to sandbox OS pathing (`os.homedir()`).

## Technical Constraints
- The tool must execute perfectly on Mac, Windows, and Linux paths.
- Secrets must never be stored raw in the configuration JSON.
