# Synctax v3 Design Spec

**Date**: 2026-04-01
**Status**: Draft
**Scope**: Core CLI fixes, safety hardening, env vault commands, audit trail, encrypted export, machine migration UX

---

## Context

Synctax v2 (Phases 0-3 complete, Phase 4 in progress) has a working sync engine with 9 adapters, profiles, backup/rollback, and an env vault scaffold. However, a full audit revealed **16 safety issues** (3 critical, 5 high), **a data leak bug** in profile publishing, and **gaps in the sync model** that block reliable multi-profile usage. This spec addresses these issues and adds the features needed for v3.

### What Prompted This

1. Default source selection during init is non-deterministic (picks first detected client alphabetically)
2. The sync command pushes one-way; users want client-first sync (pull from source, then push to all)
3. No diff preview or confirmation before sync writes to 9 client configs
4. Env vault scaffold exists but has no CLI surface
5. Critical safety issues: non-atomic writes, no file locks, silent snapshot failures
6. `profilePublishCommand` exports ALL resources regardless of profile filters (data leak)
7. Permissions are a global singleton, not profile-scoped
8. `process.env` fallback silently leaks env vars across profiles
9. No audit trail for compliance-sensitive workflows
10. No encrypted export for machine migration

### Intended Outcome

A reliable, safe, auditable CLI tool where `synctax sync` is the one-command path to keeping all AI tool configs in sync, with proper safety guards, env vault management, and encrypted export for machine migration.

---

## Design

### Section 1: Client-First Sync Model

**Problem**: Current sync is one-way push (master -> clients). Users want to designate a source client and have `synctax sync` do the full round-trip.

**Design**:

```
synctax sync [--yes] [--dry-run] [--interactive]

1. Read master config
2. Identify source client (config.source)
3. Pull from source client -> merge into master (additive, deny-wins for permissions)
4. Resolve active profile filters
5. Resolve env vault variables
6. Compute diff against ALL enabled clients (reuse diff.ts logic)
7. Display diff summary
8. Prompt: "Apply these changes? [y/N]" (skip with --yes)
9. Take atomic snapshots of all target clients
10. Push to all enabled clients (excluding source)
11. Record audit event
12. On failure: rollback with logged warnings
```

**Files to modify**:
- `src/commands/sync.ts` — Add pull-first step (call `adapter.read()` on source, merge into config), integrate diff preview, add confirmation prompt
- `src/commands/diff.ts` — Extract `compareDomain()`, `ClientDiff`, `DomainDiff` types and `renderClientDiff()` into `src/diff-utils.ts` so sync can reuse them
- `bin/synctax.ts` — Add `--yes` / `-y` flag to sync command
- `src/commands/sync.ts` (watchCommand) — Auto-pass `--yes` internally for watch daemon

**Key rules**:
- Source client is never written to during sync (it's the authority)
- `--yes` flag skips confirmation (for scripts, watch daemon, CI)
- If no source is configured, sync errors with "Run `synctax init` to set a source"
- The pull-first step uses additive merge (new resources added, existing updated by key, permissions merge-conservative)

### Section 2: Init Always-Ask + Source Validation

**Problem**: Init silently picks the first detected client as source (alphabetical order, often "antigravity" or "claude"). Memory-sync has a hardcoded "claude" fallback.

**Design**:

`src/commands/init.ts` lines 91-100 — Replace silent first-client default:

```typescript
// BEFORE (current):
if (!newConfig.source) {
  const firstClient = Object.keys(newConfig.clients)[0];
  // ...silently sets it
}

// AFTER:
if (!newConfig.source) {
  const detected = Object.entries(newConfig.clients)
    .filter(([_, c]) => c.enabled)
    .map(([id]) => ({ id, name: adapters[id]?.name || id }));

  if (detected.length > 0) {
    // Interactive: prompt user to choose
    const choice = await select({
      message: "Which client should be your source of truth?",
      choices: detected.map(d => ({ name: d.name, value: d.id }))
    });
    newConfig.source = choice;
  }
}
```

**Source validation in schema** — Add to `src/types.ts`:
```typescript
ConfigSchema.refine(
  (c) => !c.source || c.source in (c.clients || {}),
  { message: "source must reference a configured client" }
);
```

**Fix memory-sync fallback** — `src/commands/sync.ts` line 214-215:
```typescript
// BEFORE: sourceAdapter = adapters["claude"]; // hardcoded fallback
// AFTER:
if (!sourceAdapter) {
  ui.error(`Source client "${sourceId || "(none)"}" not found. Run "synctax init" to set a valid source.`);
  process.exitCode = 1;
  return;
}
```

### Section 3: Safety Hardening (16 Issues)

#### Critical Priority (Must fix)

**3.1: Atomic Writes Across All Adapters**

Every adapter writes directly to target files via `fs.writeFile()`. If the process crashes mid-write, the config file is corrupted and unrecoverable.

**Fix**: Create `src/fs-utils.ts` with an atomic write helper:
```typescript
export async function atomicWriteFile(targetPath: string, content: string, mode?: number): Promise<void> {
  const tempPath = targetPath + '.synctax-tmp';
  await fs.writeFile(tempPath, content, { encoding: 'utf-8', mode: mode ?? 0o644 });
  await fs.rename(tempPath, targetPath); // atomic on same filesystem
}
```

Replace all `fs.writeFile` calls in adapters with `atomicWriteFile`. For sensitive files (env vault), use mode `0o600`.

Files to modify: All 9 adapters in `src/adapters/`, `src/config.ts`, `src/env-vault.ts`

**3.2: File Lock for Concurrent Sync Prevention**

Two concurrent `synctax sync` calls (manual + watch daemon) can corrupt configs.

**Fix**: Create `src/lock.ts`:
```typescript
export async function acquireLock(lockPath: string): Promise<{ release: () => Promise<void> }>;
```
Uses `fs.writeFile` with `{ flag: 'wx' }` (exclusive create). Lock file contains PID + timestamp. Stale lock detection (>60s). All commands that write config acquire the lock first.

Files to modify: `src/commands/sync.ts`, `src/commands/pull.ts`, `src/commands/manage.ts`, `src/commands/profile.ts`, `src/commands/io.ts`

**3.3: Validate Before Write in ConfigManager**

`config.ts` currently validates after write setup. Flip the order:
```typescript
async write(config: Config): Promise<void> {
  const validated = ConfigSchema.parse(config); // validate FIRST
  await this.ensureConfigDir();
  await atomicWriteFile(this.configPath, JSON.stringify(validated, null, 2));
}
```

#### High Priority

**3.4: Snapshot Failures Must Warn (Not Silently Swallow)**

`sync.ts` lines 120-124 — Replace empty `catch {}`:
```typescript
} catch (err: any) {
  ui.warn(`Snapshot failed for ${adapter.name}: ${err?.message || "unknown"}. Rollback for this client will be unavailable.`);
}
```

**3.5: Env Vault process.env Fallback Must Warn**

`env-vault.ts` `resolveEnvValue()` — Add warning when falling back to `process.env`:
```typescript
if (processValue !== undefined) {
  warnings.push(`"${key}" resolved from process.env (not profile .env). Use --strict-env to disable this fallback.`);
  return { value: processValue, source: 'process.env', warnings };
}
```

Add `--strict-env` flag to sync command that disables `process.env` fallback entirely.

**3.6: File Permissions for Sensitive Writes**

All adapter writes that contain resolved env vars should use mode `0o600`:
```typescript
await atomicWriteFile(configPath, JSON.stringify(data, null, 2), 0o600);
```

**3.7: Symlink Detection Before Write**

Before writing to any file, check if it's a symlink pointing outside expected directories:
```typescript
const realPath = await fs.realpath(targetPath).catch(() => targetPath);
if (realPath !== targetPath) {
  ui.warn(`${targetPath} is a symlink to ${realPath}. Writing to real path.`);
}
```

#### Medium Priority

**3.8: Fix `profilePublishCommand` Data Leak**

`src/commands/profile.ts` — Apply profile filter before export:
```typescript
// BEFORE: resources: { mcps: config.resources.mcps, ... }  // ALL resources
// AFTER:
const filtered = await applyProfileFilter(config.resources, resolvedProfile);
const exportPayload = {
  name,
  profile: config.profiles[name],
  resources: {
    mcps: filtered.mcps,
    agents: filtered.agents,
    skills: filtered.skills,
    permissions: filtered.permissions,
    models: filtered.models,
    prompts: filtered.prompts,
    // credentials: EXCLUDED (already correct)
  }
};
```

**3.9: Resource Collision Detection on Profile Pull**

`src/commands/profile.ts` `profilePullCommand()` — Before merge, detect collisions:
```typescript
const incomingKeys = Object.keys(incoming.mcps || {});
const existingKeys = Object.keys(config.resources.mcps || {});
const collisions = incomingKeys.filter(k => existingKeys.includes(k));
if (collisions.length > 0) {
  ui.warn(`Resource name collisions detected: ${collisions.join(", ")}`);
  ui.warn(`Incoming definitions will overwrite existing ones.`);
  // Future: interactive conflict resolution
}
```

**3.10: Interactive Sync Should Include Permissions/Models/Prompts**

`sync.ts` lines 66-70 — Add checkbox groups for permissions, models, and prompts.

**3.11: TUI Viewport Fallback Should Log**

`tui/entry.ts` — When viewport is too small, log a message:
```typescript
ui.dim(`Terminal too small for TUI (need 92x24, got ${cols}x${rows}). Using interactive mode.`);
```

**3.12: Better Error Messages**

- Profile inheritance errors: Show which profile caused the cycle
- Config parse errors: Distinguish JSON syntax error from file-not-found
- Mutually exclusive options: Validate `--dry-run` + `--interactive` combination

### Section 4: Env Vault CLI Surface

**New file**: `src/commands/env.ts`

**Commands**:

```bash
synctax env set <key> <value>    # Set var in active profile's .env
synctax env list [--show]        # List vars (masked by default)
synctax env edit                 # Open .env in $EDITOR
synctax env delete <key>         # Remove var, warn if referenced by MCPs
synctax env copy <from> <to>     # Copy vars between profiles
synctax env template [--profile] # Generate .env.example listing all $VAR references
```

**Implementation details**:

- `env set`: Append or update KEY=VALUE in `~/.synctax/envs/<activeProfile>.env`. Warn if value looks like a secret passed as plaintext arg (contains `sk-`, `token`, `key` patterns).
- `env list`: Parse `.env` file, display as table. Default: mask values (`MONGO_URI=mongo***...app`). `--show` reveals full values.
- `env edit`: `$EDITOR || $VISUAL || vi` on the `.env` file path.
- `env delete`: Remove line from `.env`. Grep master config for `$KEY` references and warn if found.
- `env copy`: Read source profile's `.env`, write to destination profile's `.env` (create if missing).
- `env template`: Scan all MCP `env` fields in master config for `$VAR` patterns. Generate `.env.example` listing them with empty values and comments indicating which MCP uses each var.

**Registration in `bin/synctax.ts`**:
```typescript
const envCmd = program.command("env").description("Manage environment variables in the vault");
envCmd.command("set <key> <value>").action(...)
envCmd.command("list").option("--show").action(...)
envCmd.command("edit").action(...)
envCmd.command("delete <key>").action(...)
envCmd.command("copy <from> <to>").action(...)
envCmd.command("template").option("--profile <name>").action(...)
```

### Section 5: Audit Trail + Drift Detection

**New files**: `src/audit.ts`, `src/commands/log.ts`

**Audit event schema**:
```typescript
type AuditEvent = {
  timestamp: string;                 // ISO 8601
  event: "sync" | "pull" | "add" | "remove" | "init" |
         "profile_switch" | "restore" | "import" | "export" | "env_change";
  profile: string;                   // Active profile
  source?: string;                   // Source client (for pull/sync)
  targets?: string[];                // Target clients (for sync)
  delta: {
    mcps: { added: string[]; removed: string[]; modified: string[] };
    agents: { added: string[]; removed: string[]; modified: string[] };
    skills: { added: string[]; removed: string[]; modified: string[] };
  };
  envResolution?: {
    resolved: string[];              // Var names resolved from profile .env
    processEnvFallbacks: string[];   // Var names resolved from process.env
    unresolved: string[];            // Var names that couldn't be resolved
  };
  success: boolean;
  durationMs: number;
  rollback?: boolean;
};
```

**Storage**: `~/.synctax/audit.jsonl` (JSON Lines, append-only). Auto-rotated at 10MB (keep 3 rotations).

**New commands**:
```bash
synctax log                        # Last 20 events
synctax log --since 2d             # Events from last 2 days
synctax log --event sync           # Filter by event type
synctax log --json                 # Machine-readable
synctax log --profile <name>       # Filter by profile

synctax drift                      # Compare all clients against master
synctax drift <client>             # Compare specific client
synctax drift --json               # Machine-readable
```

**Integration points** (add `auditLog.append(event)` calls):
- `syncCommand` — after sync completes (success or failure)
- `pullCommand` — after pull completes
- `addCommand` / `removeCommand` — after resource change
- `profileUseCommand` — on profile switch
- `restoreCommand` — after restore
- `importCommand` / `exportCommand` — after IO operation
- `envSetCommand` / `envDeleteCommand` — after env change

### Section 6: Encrypted Export for Machine Migration

**Problem**: Users migrating to a new machine need to export their entire workflow (config + env vault secrets) securely.

**Design**: Two-file export model:

```bash
# Export config (no secrets, safe to share)
synctax export config-backup.json

# Export env vault (encrypted, contains secrets)
synctax env export secrets.enc
# Prompts: "Enter a passphrase to encrypt your env vault:"
# Prompts: "Confirm passphrase:"
# Output: "Encrypted vault written to secrets.enc (AES-256-GCM)"
# Warning: "Store this passphrase safely. It cannot be recovered."
```

**Import on new machine**:
```bash
# 1. Install synctax
bun install -g synctax

# 2. Init (detects clients)
synctax init

# 3. Import config
synctax import config-backup.json

# 4. Import env vault
synctax env import secrets.enc
# Prompts: "Enter passphrase:"
# Output: "Restored 3 profile env files with 12 variables total"

# 5. Sync
synctax sync --yes

# 6. Verify
synctax doctor --deep
```

**Encryption**: AES-256-GCM with PBKDF2 key derivation (zero dependencies, native Web Crypto API in Bun):
- KDF: PBKDF2, SHA-256, 600,000 iterations
- Salt: 16 bytes (random)
- IV: 12 bytes (random)
- Auth tag: 128-bit (automatic with GCM)

**Encrypted file format**:
```json
{
  "synctax_vault_export": {
    "version": 1,
    "encrypted_at": "2026-04-01T12:00:00Z",
    "profiles": ["default", "work", "personal"],
    "var_count": 12,
    "kdf": "pbkdf2",
    "kdf_iterations": 600000,
    "salt": "<base64>",
    "iv": "<base64>",
    "tag": "<base64>",
    "ciphertext": "<base64>"
  }
}
```

The `ciphertext` decrypts to:
```json
{
  "profiles": {
    "default": { "MONGO_URI": "mongodb+srv://...", "API_KEY": "sk-..." },
    "work": { "JIRA_TOKEN": "...", "DEPLOY_KEY": "..." }
  }
}
```

**New file**: `src/crypto.ts` (encryption/decryption using `crypto.webcrypto`)

**Security UX**:
1. Pre-export warning: "This will export all env vault secrets. The file will be encrypted with your passphrase."
2. Passphrase confirmation (type twice)
3. Passphrase strength hint (warn if < 12 chars, do NOT block)
4. Post-import prompt: "Delete the encrypted export file? (recommended) [Y/n]"
5. Never log or display decrypted secrets

**New commands in `bin/synctax.ts`**:
```bash
synctax env export <file>          # Encrypt and export all profile env files
synctax env import <file>          # Decrypt and import env files
```

### Section 7: Machine Migration UX Flow

**Complete migration flow (documented in help text)**:

```
OLD MACHINE                          NEW MACHINE
----------                          -----------
1. synctax export config.json        4. bun install -g synctax
2. synctax env export vault.enc      5. synctax init
3. Transfer files (AirDrop/USB/      6. synctax import config.json
   secure messaging)                 7. synctax env import vault.enc
                                     8. synctax sync --yes
                                     9. synctax doctor --deep
```

**`synctax export` should hint about env vault**:
```
Config exported to config.json (12 MCPs, 5 agents, 3 skills)

Note: This export does NOT include env vault secrets.
To also migrate your API keys and tokens, run:
  synctax env export <file>
```

**`synctax import` should hint about env vault**:
```
Config imported (12 MCPs, 5 agents, 3 skills)

Warning: 8 MCP env vars reference $PLACEHOLDER values.
If you have an encrypted vault export, run:
  synctax env import <file>
Otherwise, set your env vars with:
  synctax env edit
```

### Section 8: Additional CLI Improvements

**8.1: `--env` flag on `synctax add mcp`**

```bash
synctax add mcp my-db --command npx --args "-y,@mcp/postgres" --env "DB_URL=\$MY_DB_URL"
```

Modify `bin/synctax.ts` to expose `--env` flag (already accepted by `addCommand` in `manage.ts` but not wired).

**8.2: `--prompt-file` for agents**

```bash
synctax add agent code-reviewer --prompt-file ./prompts/reviewer.md
```

**8.3: `profile pull` from local file path**

```bash
synctax profile pull ./team-config.json --name team
```

Modify `profilePullCommand` to detect if argument is a file path (exists on disk) vs URL, and use `fs.readFile` instead of `fetch()`.

**8.4: `.env.example` template generation**

```bash
synctax env template --output .env.example
```

Scans all MCP `env` fields for `$VAR` references, generates:
```env
# Required by: company-db MCP
ACME_DB_URL=
# Required by: jira MCP
JIRA_TOKEN=
# Required by: deploy-pipeline MCP
DEPLOY_TOKEN=
```

---

## Personas and User Stories

### Persona 1: Marcus (Team Lead, 15-person team)

**Critical gaps identified**:
1. `profilePublishCommand` leaks all resources (not profile-filtered) — **Bug fix in Section 3.8**
2. No `--env` flag on `synctax add mcp` — **Fix in Section 8.1**
3. Profile include lists break personal additions (no layered model) — **Deferred to team sharing phase**
4. No compliance audit command — **Partially addressed by Section 5 (audit trail)**
5. No enforcement mechanism beyond trust — **Deferred to team sharing phase**

**Minimum viable for Marcus**: Bug fix #1, env flag, audit trail, env template generation.

### Persona 2: Sarah (Freelancer, 4 clients)

**Critical gaps identified**:
1. Permissions are a global singleton, not profile-scoped — **Deferred (requires schema change)**
2. `process.env` fallback silently leaks env vars — **Fix in Section 3.5**
3. Resource name collisions on import are silent — **Fix in Section 3.9**
4. `profilePublishCommand` exports all resources — **Fix in Section 3.8**
5. No audit log for compliance — **Fix in Section 5**

**Minimum viable for Sarah**: process.env warning, profile publish fix, collision detection, audit trail.

### Persona 3: Priya (Senior Engineer, machine migration)

**Key workflow**: Export config + encrypted env vault from old machine, import on new machine, sync, verify.

**Addressed by**: Sections 6 and 7 (encrypted export, migration UX flow).

### Persona 4: Jake (Student, first-time user)

**Key concerns**: Jargon overload, confusing init flow, no undo mechanism.

**Addressed by**: Section 2 (always-ask init with explanatory prompts), Section 1 (diff preview before sync), existing `synctax restore` for undo.

---

## Implementation Phases

| Phase | Scope | Files | Effort |
|-------|-------|-------|--------|
| **A: Safety Hardening** | Atomic writes, file locks, validate-before-write, snapshot warnings, symlink detection, process.env warnings | `src/fs-utils.ts` (new), `src/lock.ts` (new), all 9 adapters, `config.ts`, `env-vault.ts`, `sync.ts` | Medium |
| **B: Init + Source Fixes** | Always-ask init, source validation in schema, remove "claude" fallback | `init.ts`, `types.ts`, `sync.ts` | Small |
| **C: Client-First Sync + Diff Confirm** | Pull-first sync, diff preview, confirmation prompt, `--yes` flag, watch daemon pass-through | `sync.ts`, `diff.ts` -> `diff-utils.ts` (extract), `bin/synctax.ts` | Medium |
| **D: Bug Fixes** | Profile publish data leak, resource collision detection, TUI viewport message, error message improvements, interactive sync inclusion | `profile.ts`, `tui/entry.ts`, `_shared.ts`, `sync.ts` | Small |
| **E: Env Vault Commands** | `env set/list/edit/delete/copy/template` | `src/commands/env.ts` (new), `bin/synctax.ts` | Medium |
| **F: Audit Trail** | Audit logger, `synctax log`, `synctax drift`, integration hooks | `src/audit.ts` (new), `src/commands/log.ts` (new), all command files | Medium |
| **G: Encrypted Export** | AES-256-GCM encryption, `env export`/`env import`, migration UX hints | `src/crypto.ts` (new), `src/commands/env.ts`, `src/commands/io.ts` | Medium |
| **H: CLI Improvements** | `--env` flag, `--prompt-file`, local file profile pull, `.env.example` generation | `bin/synctax.ts`, `manage.ts`, `profile.ts`, `env.ts` | Small |

**Recommended order**: A -> B -> D -> C -> E -> F -> G -> H

Phase A (safety) is first because every subsequent phase builds on safe file operations. Phase B (init fixes) and D (bug fixes) are small wins. Phase C (client-first sync) is the big UX change. Phases E-H build on the foundation.

---

## Verification

### Per-Phase Testing

**Phase A**: Test atomic writes with simulated crashes (write temp file, verify target unchanged until rename). Test file locks with concurrent processes. Test validate-before-write with invalid configs.

**Phase B**: Test init prompts with mocked `@inquirer/prompts`. Test source validation rejects unknown clients. Test memory-sync errors on missing source.

**Phase C**: Test client-first sync pulls from source before pushing. Test diff preview output. Test `--yes` skips confirmation. Test watch daemon passes `--yes`.

**Phase D**: Test profile publish only exports filtered resources. Test collision warnings on profile pull. Test TUI viewport message.

**Phase E**: Test `env set` writes to correct profile file. Test `env list` masks values. Test `env delete` warns on referenced vars. Test `env template` finds all `$VAR` references.

**Phase F**: Test audit events are appended after each command. Test `synctax log` filtering. Test `synctax drift` diff output. Test audit file rotation.

**Phase G**: Test encrypt/decrypt round-trip. Test wrong passphrase rejection. Test multi-profile vault export/import. Test migration flow end-to-end.

**Phase H**: Test `--env` flag on add mcp. Test `--prompt-file` reads file. Test local file profile pull.

### End-to-End Verification

```bash
# Full migration test
synctax init                          # Always-ask source
synctax add mcp test-db --command npx --args "-y,@mcp/postgres" --env "DB_URL=\$TEST_DB"
synctax env set TEST_DB "postgres://localhost/test"
synctax sync                          # Shows diff, asks confirmation
synctax log                           # Shows sync event
synctax export /tmp/config.json       # Hints about env vault
synctax env export /tmp/vault.enc     # Encrypts env vault

# Simulate new machine
SYNCTAX_HOME=/tmp/new-machine synctax init
SYNCTAX_HOME=/tmp/new-machine synctax import /tmp/config.json
SYNCTAX_HOME=/tmp/new-machine synctax env import /tmp/vault.enc
SYNCTAX_HOME=/tmp/new-machine synctax sync --yes
SYNCTAX_HOME=/tmp/new-machine synctax doctor --deep
```

---

## Deferred (Not in This Spec)

- **Team sharing / overlay model**: Layered profiles (team base + personal overlay), enforcement, compliance commands
- **Profile-scoped permissions**: Requires schema change to move permissions inside profiles
- **New client adapters**: Windsurf, Aider, Continue.dev, Amazon Q, JetBrains AI
- **CWD-aware profile auto-switching**: `.synctaxrc` + shell hook for directory-based profiles
- **Config signing / integrity verification**: For team config distribution
- **Secrets manager integration**: 1Password, HashiCorp Vault, Doppler integrations
- **Web dashboard**: localhost UI for visual config management
