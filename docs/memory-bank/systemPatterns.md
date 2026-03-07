# System Patterns

## Architecture
- **CLI Layer:** Commander.js handling arguments and outputs via chalk.
- **Core Engine:** `ConfigManager` interacts with a `~/.synctax/config.json` master truth schema using Zod for validation.
- **Adapters:** Independent mapping modules that implements a standard interface (`ClientAdapter`). It translates master schema into proprietary local configurations.

## Design Patterns
- **Singleton Config Manager:** Handled via functional scoped instantiation (`getConfigManager()`) to allow test overriding (via `SYNCTAX_HOME`).
- **Merge-Conservative Logic:** Security takes precedence. E.g. when pulling permissions, deny lists always win.
- **Safe File Writing:** Auto `.bak` files creation before sync runs. Atomic file updates.
