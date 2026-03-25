# Synctax Full Product Audit Brief

Date: 2026-03-28
Purpose: handoff document for a separate multi-subagent audit session covering all major CLI functionality, flags, onboarding paths, and sharing flows.

## Current Baseline

- Runtime/stack: Bun + TypeScript strict mode + Commander + Zod + Vitest.
- Current verification snapshot (latest local run):
  - `bun run typecheck`: pass
  - `bun run lint`: pass with warnings (no errors)
  - `bun run test`: pass (41 files, 383 tests)
- Recent UX hardening shipped:
  - terminal capability detection and fallback behavior
  - spinner reliability improvements across TTY/non-TTY
  - `pull` failure now sets non-zero exit code
  - `sync` failure path no longer reports completion success
  - config theme fallback normalized to `rebel`

## Major Functionality Inventory (Audit Scope)

### Core lifecycle

- `init`
- `sync`
- `memory-sync`
- `pull`
- `status` (with hidden aliases `list`, `info`)
- `watch`

Primary files:
- `bin/synctax.ts`
- `src/commands/init.ts`
- `src/commands/sync.ts`
- `src/commands/pull.ts`
- `src/commands/info.ts`

### Resource management

- `add <domain> <name>`
- `remove [domain] [name]`
- `move <domain> <name>`

Primary files:
- `src/commands/manage.ts`

### Profiles and sharing

- `profile create`
- `profile use`
- `profile list`
- `profile diff`
- `profile pull <url>`
- `profile publish <name>`

Primary files:
- `src/commands/profile.ts`

### Import/export and portability

- `export <file>`
- `import <file>`
- `link`
- `unlink`

Primary files:
- `src/commands/io.ts`
- `src/commands/link.ts`

### Reliability and diagnostics

- `doctor`
- `validate`
- `diff [client]`
- `restore`
- `backup`

Primary files:
- `src/commands/info.ts` (doctor)
- `src/commands/validate.ts`
- `src/commands/diff.ts`
- `src/commands/io.ts` (restore)
- `src/commands/backup.ts`
- `src/backup/discovery.ts`
- `src/backup/archive.ts`

## Flag-Level Surface Map

Use this list as mandatory audit checklist for behavior parity, validation, UX clarity, and error semantics.

### Global

- `--theme <name>`

### init

- `--no-detect`
- `--source <client>`
- `--force`
- `--theme <name>`
- `-y, --yes`
- `--no-path-prompt`

### sync

- `--dry-run`
- `-i, --interactive`

### memory-sync

- `--source <client>`
- `--dry-run`

### pull

- `--from <client>` (required)
- `--merge`
- `--overwrite`
- `--domain <domain>`
- `-i, --interactive`

### move

- `--to-global`
- `--to-local`
- `--push`

### profile create

- `--include <names>`
- `--exclude <names>`

### profile use

- `--dry-run`
- `--no-sync`

### profile list

- `--json`

### profile diff

- `--json`

### add

- `--command <cmd>`
- `--from <url>`
- `--push`

### remove

- `--dry-run`
- `--from-all`
- `-i, --interactive`

### restore

- `--from <timestamp>`

### doctor

- `--fix`
- `--deep`

### profile pull

- `--name <name>`
- `--apply`

### profile publish

- `--output <path>`

### diff

- `--json`

### validate

- `--strict`

### backup

- `--client <id>` (repeatable)
- `-i, --interactive`
- `--layout <mode>`
- `--output <path>`
- `--rollup`

## Test Coverage Map (High-Level)

### Strongly covered

- adapter read/write behavior across supported clients
- core command behavior (`tests/commands.test.ts`)
- profile workflows (`tests/profiles.test.ts`)
- rollback behavior (`tests/sync-rollback.test.ts`)
- import/export (`tests/export_import.test.ts`)
- memory sync and sanity paths (`tests/sanity_checks.test.ts`)
- UI output and new terminal capability/spinner behavior (`tests/ui/*.test.ts`)

### Needs deeper audit attention

- `watch` behavior under real file churn and daemon lifecycle (`tests/watch.test.ts` is smoke-oriented)
- `validate --strict` currently reserved/no-op beyond baseline checks
- backup scenarios beyond happy path matrix (large files, permissions, symbolic links, partial writes, restore path confidence)
- profile sharing trust model (remote payload validation depth, authenticity, compatibility negotiation)
- import interactive prompt behavior in non-TTY automation contexts
- onboarding UX around env vars, dependencies, and install requirements

## Known Strengths

- command architecture is modular and test-driven
- schema-validated master config with defaults reduces undefined behavior
- adapter system cleanly separates client-specific translation concerns
- recent terminal UX reliability fixes improved consistency across environments

## Known Risk Areas / Gaps

### 1) Shareable profile format maturity

- profile pull/publish payload is practical but minimally opinionated
- no explicit first-class contract for dependency/install requirements
- no standardized onboarding metadata (required env vars, optional env vars, install steps)
- no authenticity model (signatures/checksum/trust policy)

### 2) Onboarding ergonomics

- users can import/pull profiles but setup guidance is limited
- missing explicit "what you need to install" and "what env vars are required" assistant flow

### 3) Flag semantics consistency

- several commands expose flags whose interplay deserves adversarial testing (`--merge` vs `--overwrite`, `--dry-run` behavior parity, `--interactive` + non-TTY)

### 4) Operational resilience

- daemon and backup recovery behavior should get chaos-style testing and cross-platform edge-case checks

## Multi-Subagent Audit Plan (For Separate Session)

Use this as your launch blueprint.

### Required subagents

1. CLI UX and information architecture reviewer
2. Command semantics and flag behavior reviewer
3. Profile/share format reviewer
4. Backup/recovery reliability reviewer
5. Security and supply-chain reviewer
6. Adapter conformance reviewer
7. Test coverage and quality reviewer
8. Documentation and onboarding reviewer
9. Adversarial nemesis reviewer (mandatory)

### Expected outputs from each subagent

- findings grouped by P0/P1/P2/P3
- exact file and command references
- concrete reproduction or failure scenarios
- clear fix recommendation (minimal patch direction)
- what already looks good (to avoid noise)

### Synthesis rules

- elevate any issue found by 2+ agents to cross-cutting priority
- treat nemesis-only findings as candidate issues until validated
- produce an integrated action list split by:
  - short-term fixes (this week)
  - structural improvements (next milestone)
  - deferred items (documented rationale)

## Ready-to-Use Prompt For The Separate Session

```
Run a full Synctax product audit with parallel subagents.

Audit every major functionality and every flag behavior:
- init, sync, memory-sync, pull, status/list/info, watch
- add/remove/move
- profile create/use/list/diff/pull/publish
- export/import
- link/unlink
- doctor, validate, diff, restore, backup

Also deeply audit shareability and onboarding UX:
- How a user copies someone else's full workflow
- Required installs and env vars discovery
- Profile portability, compatibility, and trust/safety

Use these constraints:
- Produce P0/P1/P2/P3 findings
- Include exact file and command references
- Include fix recommendations
- Include what is already good
- Include a final prioritized implementation roadmap

Use docs/plans/2026-03-28-full-product-audit-brief.md as the baseline context and validate all claims against code and tests.
```

## New Initiative Seed: Portable Share Package

Target outcome for next implementation cycle:

- define a first-class share file format (schema-versioned)
- include:
  - profile filters and resources
  - required env vars and optional env vars
  - required binaries/dependencies and install hints
  - compatibility metadata (synctax version, clients)
  - onboarding checklist
- provide commands to inspect and apply package with guided setup

This should be treated as a product-level UX feature, not only a data export feature.
