# Phase 4 Env Vault + Native Backup Design

## Context

Phase 3 is feature-complete and stable. Phase 4 adds two capabilities:

1. Env Vault (profile-scoped `.env` files and sync-time env resolution).
2. Native client backup (real client files, not Synctax schema export/import).

This design incorporates updated UX direction from the current session:

- default backup is a single bundled zip
- selecting one client is supported
- selecting many clients is supported
- bundled zip contains one folder per client
- backup zip output path is configurable

## Goals

1. Keep `export/import` separate from native client backups.
2. Make all-client backup one-step and centralized (single artifact by default).
3. Preserve scope-aware file capture (user/project/local/global where available).
4. Support partial success with clear warnings for missing/unreadable files.
5. Keep implementation incremental and TDD-first.

## Non-Goals (Phase 4)

1. Full native restore orchestration across all clients.
2. Encrypted archives and key management.
3. Auto-discovery of arbitrary project roots beyond current cwd.

## UX + CLI Surface

### Primary command

`synctax backup`

Defaults:

- layout: `bundle`
- client set: all enabled clients
- output file: `./synctax-backup-<timestamp>.zip`

### Options

- `--client <id>` (repeatable): select one or many clients explicitly.
- `--interactive`: choose clients from a checkbox prompt.
- `--layout <bundle|per-client>`:
  - `bundle` (default): one zip containing multiple client folders.
  - `per-client`: one zip per selected client.
- `--output <path>`:
  - bundle: output zip file path.
  - per-client: output directory root for generated per-client zip files.
- `--rollup`: produce an additional rollup manifest artifact for the run.

## Artifact Model

### Bundle mode (default)

One zip contains all selected clients.

Archive layout:

```text
manifest.json
clients/<client-id>/manifest.json
clients/<client-id>/files/<scope>/<normalized-absolute-source-path>
```

### Per-client mode

One zip per selected client.

Archive layout:

```text
manifest.json
files/<scope>/<normalized-absolute-source-path>
```

### Rollup

When `--rollup` is provided:

- create an additional rollup manifest artifact summarizing created backup artifacts, statuses, checksums, and warnings.

## Manifest Model

### Per-client manifest fields

- `manifestVersion`
- `kind` (`synctax-client-backup`)
- `client.id`, `client.name`
- `createdAt`
- `files[]` entries with:
  - `scope`
  - `kind`
  - `sourceAbsPath`
  - `archivePath`
  - `size`
  - `sha256`
- `totals.fileCount`, `totals.byteCount`
- `status` (`success|partial|failed|skipped`)
- `warnings[]`

### Bundle manifest fields

- `manifestVersion`
- `kind` (`synctax-backup-bundle`)
- `createdAt`
- `selectedClients[]`
- `results[]` (per-client status summary)
- `totals`

## Scope + Path Discovery Strategy

### Approach

Use a centralized backup discovery layer with adapter-aware rules and optional adapter override hooks.

Design rationale:

1. Avoid immediate churn across all adapters.
2. Reuse existing path logic in `src/platform-paths.ts` and adapter conventions.
3. Keep room for adapter-native discovery methods later.

### Discovery output model

Each discovered candidate includes:

- `clientId`
- `path` (absolute)
- `scope` (`global|user|project|local`)
- `kind` (`config|mcp|agents-dir|skills-dir|memory-file|...`)
- `exists`
- `label`

### Inclusion rules

1. Include resolvable user/global files.
2. Include project/local files for current cwd.
3. Include agent/skill directories when applicable.
4. Include memory/rules file for selected project.
5. Missing/unreadable paths become warnings, not hard failures.

## Zip + Determinism Strategy

### Library

Use `fflate` for zip creation and test-time archive inspection.

### Deterministic behavior

1. Sort archive entries by `scopeRank` then archive path.
2. Normalize path separators to `/`.
3. Store stable manifest ordering.
4. Compute SHA256 per included file.

## Error Handling + Exit Codes

Per-client outcomes:

- `success`: all discovered readable files archived.
- `partial`: archive created with warnings/skips.
- `failed`: no archive produced for that client.
- `skipped`: selected but no eligible files discovered.

Process exit behavior:

- all success/skipped => exit code `0`
- any partial/failed => exit code `1`

## Env Vault (Phase 4 prep)

1. Add `EnvVault` service (`src/env-vault.ts`) for profile env loading and value resolution.
2. Resolve `$VAR` references at sync time before adapter writes.
3. Create profile `.env` file on profile creation/use when absent.

Security rules:

- `.env` files are local-only and not exported/published.
- unresolved values remain symbolic and generate warnings.

## Restore Strategy Boundary

Phase 4 ships backup-first.

Phase 4.5 adds native restore orchestration with strict conflict policies and checksum validation workflows.

## Incremental Delivery

1. Interactive bug fix (loop + escape handling) first.
2. Backup discovery abstraction.
3. `synctax backup` bundle mode + client selection + configurable output.
4. `--layout per-client` and `--rollup` artifact.
5. Env Vault scaffolding and sync integration.
