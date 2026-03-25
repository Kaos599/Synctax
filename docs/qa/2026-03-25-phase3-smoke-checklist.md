# Phase 3 Smoke Checklist

## Preconditions

- Run from repository root.
- Ensure `SYNCTAX_HOME` points to your intended sandbox/home.
- Ensure master config exists (`~/.synctax/config.json` equivalent for current `SYNCTAX_HOME`).

## Core command checks

Run each command and verify it exits cleanly unless the check is expected to report issues:

```bash
bun ./bin/synctax.ts status
bun ./bin/synctax.ts diff
bun ./bin/synctax.ts validate
bun ./bin/synctax.ts doctor
bun ./bin/synctax.ts doctor --deep
```

Expected:
- `status` shows enabled clients and sync/drift state without runtime errors.
- `diff` prints per-client add/remove/modify buckets.
- `validate` reports pass/fail with non-zero exit code on hard failures.
- `doctor --deep` checks MCP command availability and required env vars.

## Profile workflow checks

```bash
bun ./bin/synctax.ts profile list
bun ./bin/synctax.ts profile list --json
bun ./bin/synctax.ts profile diff default
bun ./bin/synctax.ts profile diff default --json
```

Expected:
- active profile marker appears in `profile list`.
- `profile diff` shows included/excluded resources by domain.
- JSON variants output parseable JSON payloads.

## Link/unlink checks

```bash
bun ./bin/synctax.ts link
bun ./bin/synctax.ts unlink
```

Expected:
- `link` creates `.synctax/instructions.md` and symlinks known memory files where safe.
- `unlink` converts symlinks back to regular files without deleting unrelated files.
- Re-running both commands is idempotent.

## MCP import from URL checks

Use a known test URL payload and verify both success and rejection cases:

```bash
bun ./bin/synctax.ts add mcp demo --from <valid-url>
bun ./bin/synctax.ts add mcp demo-bad --from <invalid-url-or-payload>
```

Expected:
- valid payload imports MCP successfully.
- invalid payload reports clear error and does not mutate config.

## Verification commands

```bash
bun run test
bunx tsc --noEmit
```

Current known status (2026-03-25):
- tests: passing
- typecheck: currently fails due to pre-existing repository-wide TypeScript issues outside this Phase 3 scope
