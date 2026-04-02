# Synctax v3 — Master Implementation Plan

> **Spec:** `docs/specs/2026-04-01-synctax-v3-design.md`
> **Baseline:** 46 test suites, 433 tests, all passing. Phases 0-3 complete, Phase 4 in progress.

---

## What We're Building

Synctax v3 transforms the tool from a one-way config pusher into a **safe, auditable, client-first sync engine** with encrypted machine migration and a complete env vault CLI. It fixes 16 safety issues, 1 data leak bug, and 3 UX gaps identified during the audit.

### User-Facing Changes (What People Will Notice)

| Before (v2) | After (v3) |
|-------------|------------|
| `synctax sync` blindly pushes master → clients | `synctax sync` pulls from source client first, shows diff, asks confirmation |
| `synctax init` silently picks first detected client as source | `synctax init` always asks the user to choose |
| `memory-sync` hardcodes "claude" as fallback | Errors clearly if no source is configured |
| No way to manage env vault from CLI | `synctax env set/list/edit/delete/copy/template` |
| No history of what changed | `synctax log` shows full audit trail |
| No way to see if clients are out of sync | `synctax drift` shows per-client divergence |
| `synctax export` only exports config (no secrets) | `synctax env export` encrypts & exports the vault for machine migration |
| `synctax profile publish` leaks ALL resources | Only exports resources matching the profile's include/exclude list |
| `process.env` silently resolves missing vars | Warns when falling back to process.env |
| Crash during write = corrupted config | Atomic writes (temp file + rename) everywhere |
| Two concurrent syncs = data corruption | File lock prevents concurrent operations |

---

## Phase Overview

```
Phase A ─── Safety Hardening ──────────── Foundation (everything depends on this)
  │
  ├── Phase B ─── Init + Source Fixes ─── Small, quick wins
  │
  ├── Phase D ─── Bug Fixes ───────────── Data leak fix, collision warnings
  │
  └── Phase C ─── Client-First Sync ───── The big UX change
        │
        ├── Phase E ─── Env Vault CLI ─── Complete the env vault surface
        │
        ├── Phase F ─── Audit Trail ────── Log, drift detection
        │
        └── Phase G ─── Encrypted Export ─ Machine migration
              │
              └── Phase H ─── CLI Polish ─ --env flag, --prompt-file, local profile pull
```

---

## Phase A: Safety Hardening

**Why first:** Every other phase writes files. If writes aren't safe, nothing else matters.

### Deliverables

| # | What | File | Risk it fixes |
|---|------|------|--------------|
| A1 | `atomicWriteFile()` utility | `src/fs-utils.ts` (new) | Crash during write = corrupted config |
| A2 | `atomicWriteSecure()` utility (mode 0o600) | `src/fs-utils.ts` | Secrets written world-readable |
| A3 | Exclusive file lock | `src/lock.ts` (new) | Two concurrent syncs = data corruption |
| A4 | ConfigManager: validate before write + atomic | `src/config.ts` | Invalid config written to disk |
| A5 | Snapshot failure warnings | `src/commands/sync.ts` | Silent rollback gaps |
| A6 | process.env fallback warning | `src/env-vault.ts` | Cross-profile credential leakage |
| A7 | Migrate all 9 adapters to atomicWriteFile | `src/adapters/*.ts` (31 call sites) | Crash = corrupted client configs |

### Tests to write
- `tests/fs-utils.test.ts` — atomic write, secure write, parent dir creation, no leftover temp files
- `tests/lock.test.ts` — acquire, release, contention error, stale lock reclaim
- Extend `tests/config.test.ts` — validate-before-write, atomic write
- Extend `tests/env-vault.test.ts` — process.env fallback warning
- Extend `tests/commands.test.ts` — snapshot failure warning

### Estimated scope
- 2 new files, 11 modified files, ~19 new tests
- The adapter migration (A7) is mechanical: replace `fs.writeFile(path, content, "utf-8")` with `atomicWriteFile(path, content)` across 31 call sites

---

## Phase B: Init + Source Fixes

**Why second:** Quick wins that fix confusing UX. No dependency on other phases.

### Deliverables

| # | What | File |
|---|------|------|
| B1 | Always-ask source selection during init (interactive prompt) | `src/commands/init.ts` |
| B2 | If only 1 client detected, auto-select with message (no prompt) | `src/commands/init.ts` |
| B3 | Non-interactive fallback (CI/test) — pick first, log message | `src/commands/init.ts` |
| B4 | Remove hardcoded "claude" fallback in memory-sync | `src/commands/sync.ts` |
| B5 | Error clearly when source client is not found | `src/commands/sync.ts` |

### Tests to write
- Init prompts user to select source (mock `@inquirer/prompts` select)
- Init auto-selects when only 1 client detected
- memory-sync errors on invalid source instead of defaulting to claude

### Estimated scope
- 2 modified files, ~3 new tests

---

## Phase C: Client-First Sync + Diff Confirmation

**Why this is the big one:** Changes the core sync model from "push-only" to "pull → diff → confirm → push."

### Deliverables

| # | What | File |
|---|------|------|
| C1 | Extract diff utilities into shared module | `src/diff-utils.ts` (new, extracted from `src/commands/diff.ts`) |
| C2 | Pull-first step in syncCommand (read from source client, merge into master) | `src/commands/sync.ts` |
| C3 | Diff preview before write (reuse C1 utilities) | `src/commands/sync.ts` |
| C4 | Confirmation prompt ("Apply these changes? [y/N]") | `src/commands/sync.ts` |
| C5 | `--yes` flag to skip confirmation | `bin/synctax.ts` + `src/commands/sync.ts` |
| C6 | `--strict-env` flag to block process.env fallback | `bin/synctax.ts` + `src/commands/sync.ts` |
| C7 | Watch daemon auto-passes `--yes` | `src/commands/sync.ts` (watchCommand) |
| C8 | Source client excluded from write targets | `src/commands/sync.ts` |
| C9 | Lock acquisition around sync (uses Phase A lock) | `src/commands/sync.ts` |

### New sync flow
```
synctax sync
  1. Acquire lock
  2. Read master config
  3. Pull from source client → additive merge into master
  4. Apply profile filter + env vault resolution
  5. Compute diff against all enabled clients
  6. Display diff summary (+ / - / ~ per client per domain)
  7. If not --yes: prompt "Apply these changes? [y/N]"
  8. Take snapshots of all target clients
  9. Write to all enabled clients (excluding source)
  10. Release lock
  11. On failure: rollback + release lock
```

### Tests to write
- Sync pulls from source before pushing
- Sync shows diff and waits for confirmation
- `--yes` skips confirmation
- Source client not written to
- Watch daemon auto-confirms
- Lock prevents concurrent syncs

### Estimated scope
- 1 new file (diff-utils extraction), 3 modified files, ~8 new tests

---

## Phase D: Bug Fixes

**Why here:** Small, targeted fixes that don't depend on the sync model change.

### Deliverables

| # | What | File | Bug |
|---|------|------|-----|
| D1 | Profile publish: filter resources by profile before export | `src/commands/profile.ts` | Data leak — exports ALL resources regardless of profile |
| D2 | Profile pull: warn about resource name collisions | `src/commands/profile.ts` | Silent overwrites on import |
| D3 | TUI viewport fallback: log explanatory message | `src/tui/entry.ts` | Silent degradation to interactive mode |
| D4 | Interactive sync: add permissions/models/prompts to checkbox | `src/commands/sync.ts` | Can't selectively sync non-MCP resources |

### Tests to write
- Profile publish only exports filtered resources
- Profile pull warns on name collisions
- TUI logs viewport message when too small

### Estimated scope
- 3 modified files, ~4 new tests

---

## Phase E: Env Vault CLI Commands

**Why here:** The env vault scaffold exists (`src/env-vault.ts`), profile `.env` files are created. What's missing is the CLI surface.

### Deliverables

| # | Command | What it does |
|---|---------|-------------|
| E1 | `synctax env set <key> <value>` | Write/update KEY=VALUE in active profile's `.env` file |
| E2 | `synctax env list [--show]` | List vars (masked by default, `--show` reveals values) |
| E3 | `synctax env edit` | Open `.env` file in `$EDITOR` / `$VISUAL` / `vi` |
| E4 | `synctax env delete <key>` | Remove var from `.env`, warn if MCPs reference `$KEY` |
| E5 | `synctax env copy <from> <to>` | Copy vars between profiles' `.env` files |
| E6 | `synctax env template [--output]` | Scan MCPs for `$VAR` references, generate `.env.example` |

### Files
- Create: `src/commands/env.ts` (all 6 commands)
- Modify: `src/commands/index.ts` (re-export)
- Modify: `bin/synctax.ts` (register env subcommand group)
- Create: `tests/env-commands.test.ts`

### Tests to write
- `env set` writes to correct profile file
- `env set` updates existing key
- `env list` masks values by default
- `env list --show` reveals values
- `env delete` removes key
- `env delete` warns when MCPs reference the deleted var
- `env copy` copies between profiles
- `env template` finds all `$VAR` references in MCPs

### Estimated scope
- 1 new file, 2 modified files, ~10 new tests

---

## Phase F: Audit Trail + Drift Detection

**Why here:** Now that sync, pull, and env commands all work correctly, we can instrument them with audit logging.

### Deliverables

| # | What | File |
|---|------|------|
| F1 | Audit logger (append-only JSONL) | `src/audit.ts` (new) |
| F2 | `synctax log` command with filtering | `src/commands/log.ts` (new) |
| F3 | `synctax drift` command (compare clients vs master) | `src/commands/drift.ts` (new) |
| F4 | Hook audit logging into sync, pull, add, remove, profile switch, restore, import, export | All command files |
| F5 | Audit file rotation (>10MB, keep 3) | `src/audit.ts` |

### Audit event schema
```
{ timestamp, event, profile, source?, targets?, delta: { mcps, agents, skills }, envResolution?, success, durationMs, rollback? }
```

### New commands
```bash
synctax log                    # Last 20 events
synctax log --since 2d         # Time filter
synctax log --event sync       # Event type filter
synctax log --json             # Machine-readable

synctax drift                  # All clients vs master
synctax drift <client>         # Specific client
synctax drift --json           # Machine-readable
```

### Tests to write
- Audit event appended after sync
- `synctax log` reads and displays events
- `synctax log --since` filters by time
- `synctax drift` shows per-client divergence
- Audit file rotation at 10MB

### Estimated scope
- 3 new files, 8+ modified files (adding audit hooks), ~8 new tests

---

## Phase G: Encrypted Export (Machine Migration)

**Why here:** Depends on env vault CLI (Phase E) for the vault to be worth exporting.

### Deliverables

| # | What | File |
|---|------|------|
| G1 | AES-256-GCM encryption/decryption with PBKDF2 | `src/crypto.ts` (new) |
| G2 | `synctax env export <file>` — encrypt all profile .env files | `src/commands/env.ts` |
| G3 | `synctax env import <file>` — decrypt and restore .env files | `src/commands/env.ts` |
| G4 | `synctax export` hints about env vault export | `src/commands/io.ts` |
| G5 | `synctax import` hints about unresolved env vars | `src/commands/io.ts` |
| G6 | Passphrase UX: confirm twice, strength hint, post-import cleanup prompt | `src/commands/env.ts` |

### Encryption spec
- Algorithm: AES-256-GCM (native Web Crypto API, zero dependencies)
- KDF: PBKDF2-HMAC-SHA256, 600,000 iterations
- Salt: 16 bytes random, IV: 12 bytes random
- File format: JSON envelope with metadata + base64 ciphertext

### Migration flow
```
OLD MACHINE                          NEW MACHINE
1. synctax export config.json        4. bun install -g synctax
2. synctax env export vault.enc      5. synctax init
3. Transfer (AirDrop/USB/etc)        6. synctax import config.json
                                     7. synctax env import vault.enc
                                     8. synctax sync --yes
                                     9. synctax doctor --deep
```

### Tests to write
- Encrypt/decrypt round-trip
- Wrong passphrase rejected (auth tag mismatch)
- Multi-profile vault export/import
- Export hints about env vault
- Import hints about unresolved vars

### Estimated scope
- 1 new file, 2 modified files, ~7 new tests

---

## Phase H: CLI Polish

**Why last:** Nice-to-haves that improve ergonomics. No safety or correctness impact.

### Deliverables

| # | What | File |
|---|------|------|
| H1 | `--env` flag on `synctax add mcp` (already accepted in code, not wired in CLI) | `bin/synctax.ts` |
| H2 | `--prompt-file` flag on `synctax add agent` (read prompt from file) | `bin/synctax.ts` + `src/commands/manage.ts` |
| H3 | `synctax profile pull` from local file path (not just URLs) | `src/commands/profile.ts` |
| H4 | Expose `--env` parsing in `addCommand` | `src/commands/manage.ts` |

### Tests to write
- `--env` flag on add mcp creates env placeholder
- `--prompt-file` reads file content as prompt
- `profile pull ./local.json` works without fetch

### Estimated scope
- 3 modified files, ~4 new tests

---

## Dependency Graph

```
A (Safety) ──→ B (Init fixes)
           ──→ D (Bug fixes)
           ──→ C (Client-first sync) ──→ E (Env vault CLI) ──→ G (Encrypted export)
                                     ──→ F (Audit trail)
                                                            ──→ H (CLI polish)
```

**Parallelizable:**
- B and D can run in parallel (both only depend on A)
- E and F can run in parallel (both depend on C but not on each other)
- G and H can run in parallel (G depends on E, H is independent)

---

## Total Scope

| Phase | New files | Modified files | New tests | Commits |
|-------|-----------|---------------|-----------|---------|
| A: Safety | 4 (2 src + 2 test) | 11 | ~19 | 3-4 |
| B: Init | 0 | 2 | ~3 | 2 |
| C: Sync | 1 | 3 | ~8 | 3 |
| D: Bugs | 0 | 3 | ~4 | 3 |
| E: Env CLI | 2 (1 src + 1 test) | 2 | ~10 | 2 |
| F: Audit | 4 (3 src + 1 test) | 8+ | ~8 | 3 |
| G: Crypto | 2 (1 src + 1 test) | 2 | ~7 | 2 |
| H: Polish | 0 | 3 | ~4 | 2 |
| **Total** | **13** | **~34** | **~63** | **~20** |

Final test count: ~496 tests across ~52 suites (up from 433/46).

---

## How to Execute

Each phase gets its own detailed task-level plan (like the one already written for Phases A+B+D). Phases that can be parallelized will be dispatched to parallel subagents.

**Suggested execution batches:**

1. **Batch 1:** Phase A (safety) — must go first, everything depends on it
2. **Batch 2:** Phases B + D in parallel — small, independent fixes
3. **Batch 3:** Phase C (client-first sync) — the big UX change
4. **Batch 4:** Phases E + F in parallel — env vault CLI + audit trail
5. **Batch 5:** Phases G + H in parallel — encrypted export + CLI polish
6. **Final:** End-to-end smoke test of the full migration workflow
