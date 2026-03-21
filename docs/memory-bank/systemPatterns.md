# System Patterns

## Architecture
- **CLI Layer:** Commander.js routing. Enhanced with `cli-table3` for matrix views and `chalk` for custom dull-neon hex themes (`#362F4F`, `#5B23FF`, etc.).
- **Core Engine:** `ConfigManager` interacts with a `~/.synctax/config.json` master schema using Zod for robust parsing.
- **Adapters:** Highly abstracted `ClientAdapter` interface. Adapters are responsible for mapping master logic to unique internal schemas (e.g., `mcpServers` vs `mcp.servers` vs `context_servers`).
- **Daemon Layer:** `chokidar`-based background observer that watches `config.json` and executes debounced `syncCommand` cascades automatically.

## Design Patterns
- **Test-Driven Development (TDD):** Every feature must be prefaced with a failing (RED) unit test inside `tests/` which is subsequently solved (GREEN).
- **Filesystem Mocking:** All absolute paths must resolve dynamically via `process.env.SYNCTAX_HOME || os.homedir()`. `process.cwd()` logic must be spied and mocked in tests to prevent developers from overwriting their local configurations by simply running the test suite.
- **Merge-Conservative Logic:** Security is paramount. When syncing network configs or permissions, restrictive deny-lists override permissive allow-lists. Secrets are maintained strictly as `$ENV_VAR` references.
- **Debounced I/O:** The file watcher utilizes a `setTimeout` clear pattern to avoid hammering the OS with writes if a developer furiously hits `cmd+s`.
