# Synctax Multi-Persona Product Audit (2026-04-07)

## Scope

- Requested by user: comprehensive, user-facing problem report across all aspects.
- Contributor experience is intentionally excluded.
- Personas used:
  - First-time Windows solo developer
  - Team lead / DevOps admin
  - Security / compliance engineer
  - Power CLI/TUI user
  - Cross-platform daily user (Windows + macOS/Linux)
- Sources:
  - Static code inspection across `src`, `bin`, tests, and docs
  - Cross-checked UX expectations against:
    - NN/g usability heuristics
    - Microsoft CLI design guidance
    - CLI Guidelines (`clig.dev`)

## Interpretation Rules

- **Confirmed**: directly supported by current code paths.
- **Inferred Risk**: likely practical issue based on behavior, platform constraints, or UX consistency gap; needs runtime confirmation.
- **Feature Gap**: not a defect in current logic, but missing capability users commonly expect.

## Severity Scale

- **High**: can cause data loss/corruption, broken install path, security exposure, or trust-breaking behavior.
- **Medium**: causes regular friction, confusing behavior, or reduced operational safety.
- **Low**: quality, discoverability, wording, or polish issue with limited blast radius.

---

## A) Onboarding and Discoverability

### ONB-01 - PATH installer points to non-shipped CLI entrypoint

- Severity: High
- Status: Confirmed
- Evidence: `src/install-path.ts`, `package.json`
- Problem:
  - PATH installer resolves CLI to `bin/synctax.ts`.
  - Published package only ships `dist/` and maps binary to `./dist/synctax.js`.
- User impact:
  - npm-installed users can get PATH launcher failures or unusable launcher scripts.
- Repro:
  1. Install packaged build from npm tarball/global install.
  2. Run `synctax init` and accept PATH setup.
  3. Observe "Could not find CLI entry" path targeting `bin/synctax.ts`.
- Recommended fix:
  - Resolve launcher target from packaged runtime entry (`dist/synctax.js`) in production installs.
  - Keep dev-time fallback only for local repo execution.

### ONB-02 - Windows PATH prompt uses Unix-style home path text

- Severity: Low
- Status: Confirmed
- Evidence: `src/install-path.ts`
- Problem:
  - Prompt asks to add `~/.synctax/bin` even on Windows.
- User impact:
  - New Windows users can misread setup instructions and lose confidence early.
- Repro:
  1. Run `synctax init` on Windows with interactive PATH prompt.
  2. Prompt text references `~/.synctax/bin`.
- Recommended fix:
  - Render OS-specific path text (`%USERPROFILE%\\.synctax\\bin` on Windows).

### ONB-03 - No dedicated "setup/init" action in TUI quick workflows

- Severity: Medium
- Status: Confirmed
- Evidence: `src/tui/actions.ts`, `src/tui/data.ts`
- Problem:
  - TUI action set has no `init` flow.
  - TUI can warn "No enabled clients configured" but does not provide one-step remediation.
- User impact:
  - First-run users in no-arg mode can get stuck in diagnostics without obvious setup path.
- Repro:
  1. Start with empty config.
  2. Run `synctax` (TUI mode).
  3. Observe warning state without direct setup action.
- Recommended fix:
  - Add `init`/`setup` action and route from empty-state warning.

### ONB-04 - Non-interactive `init` auto-selects first detected source

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/init.ts`
- Problem:
  - If multiple clients are detected and no TTY is available, source defaults to first detected client.
- User impact:
  - Automation/CI may set unintended source-of-truth silently.
- Repro:
  1. Make multiple clients detectable.
  2. Run `synctax init` in non-interactive mode without `--source`.
  3. Observe first client chosen as source.
- Recommended fix:
  - Require `--source` when non-interactive and multiple clients exist.

### ONB-05 - Existing-config init exits without guided next steps

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/init.ts`
- Problem:
  - `init` warns "Configuration already exists. Use --force to overwrite." and returns.
  - No guidance to `status`, `pull`, `doctor`, or profile commands.
- User impact:
  - New users repeating init get blocked with no directed recovery path.
- Repro:
  1. Initialize once.
  2. Run `synctax init` again.
  3. Observe warning-only exit.
- Recommended fix:
  - Add actionable next-step hints after early exit.

### ONB-06 - `info` command is hidden in CLI help

- Severity: Low
- Status: Confirmed
- Evidence: `bin/synctax.ts`
- Problem:
  - `info` is marked hidden while still implemented and used in TUI.
- User impact:
  - Discoverability mismatch between interactive surfaces and CLI help.
- Repro:
  1. Run `synctax --help`.
  2. `info` is hidden from command listing.
- Recommended fix:
  - Unhide command or fully deprecate/remove it from user-facing flows.

### ONB-07 - Doctor header uses old product name

- Severity: Low
- Status: Confirmed
- Evidence: `src/commands/info.ts`
- Problem:
  - Header says "Diagnosing agentsync setup..." instead of Synctax.
- User impact:
  - Branding inconsistency reduces perceived reliability.
- Repro:
  1. Run `synctax doctor`.
  2. Observe header text.
- Recommended fix:
  - Replace legacy string with Synctax name.

### ONB-08 - Doctor can return "All checks passed" with zero enabled clients

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/info.ts`
- Problem:
  - `healthy` defaults true and remains true when there are no enabled clients to validate.
- User impact:
  - False confidence in unusable or incomplete setup.
- Repro:
  1. Use config with no enabled clients.
  2. Run `synctax doctor`.
  3. Observe pass message.
- Recommended fix:
  - Treat zero-enabled-client state as warning/fail with explicit setup guidance.

---

## B) Sync, Pull, Watch, and Operational Reliability

### SYNC-01 - `sync --dry-run` can still write master config

- Severity: High
- Status: Confirmed
- Evidence: `src/commands/sync.ts`, `bin/synctax.ts`
- Problem:
  - Dry-run is documented as non-writing, but source-pull stage can call `configManager.write(config)`.
- User impact:
  - Dry-run loses trust; automation may mutate state unexpectedly.
- Repro:
  1. Configure source client with resources not in master.
  2. Run `synctax sync --dry-run`.
  3. Observe master config can change due to source merge write.
- Recommended fix:
  - Guard all writes behind `!options.dryRun` in every stage.

### SYNC-02 - Pull/profile commands write master without backup snapshot

- Severity: High
- Status: Confirmed
- Evidence: `src/commands/pull.ts`, `src/commands/profile.ts`, `src/commands/sync.ts`, `src/commands/io.ts`
- Problem:
  - Backup is used in sync and import paths, but not before pull/profile writes.
- User impact:
  - Harder recovery from accidental merges/overwrites.
- Repro:
  1. Run `pull` or `profile pull/use/create`.
  2. Compare backup behavior to `sync` and `import`.
- Recommended fix:
  - Standardize backup-before-write across all mutating master-config commands.

### SYNC-03 - Locking only protects `sync`

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - `acquireLock("sync")` is not reused by other mutating commands.
- User impact:
  - Concurrent pull/profile/import/sync operations can race on config updates.
- Repro:
  1. Trigger sync and pull concurrently against same home.
  2. Observe no shared lock coordination.
- Recommended fix:
  - Add shared config lock for all master-write operations.

### SYNC-04 - Source merge in sync excludes models/prompts/credentials

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/sync.ts`, `src/commands/pull.ts`
- Problem:
  - Source merge in sync updates mcps/agents/skills/permissions only.
  - `pull` handles models/prompts (and carries credentials structure).
- User impact:
  - Inconsistent behavior between sync and pull flows.
- Repro:
  1. Set model/prompt differences in source client.
  2. Run sync with source merge.
  3. Observe these domains not merged.
- Recommended fix:
  - Align domain handling between source-merge path and pull semantics.

### SYNC-05 - Analyze failures do not block write stage

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - Analyze errors are explicitly logged, but sync still attempts writes.
- User impact:
  - Fail-open behavior can propagate changes despite incomplete visibility.
- Repro:
  1. Force analyze read failure on one client.
  2. Run sync.
  3. Observe warning plus continued write attempts.
- Recommended fix:
  - Add strict/fail-closed mode or default blocking on analyze failures.

### SYNC-06 - Diff domain model is limited to MCPs/agents/skills

- Severity: Medium
- Status: Confirmed
- Evidence: `src/diff-utils.ts`
- Problem:
  - `DomainKey` includes only `"mcps" | "agents" | "skills"`.
- User impact:
  - Sync planning/drift visibility misses permissions/models/prompts.
- Repro:
  1. Create model/prompt/permission drift.
  2. Run diff/sync plan.
  3. Observe absent domain-level reporting.
- Recommended fix:
  - Expand diff framework to include additional resource domains.

### SYNC-07 - Dry-run bypasses "already in sync" early-exit path

- Severity: Low
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - "All clients are already in sync" return logic is inside non-dry-run branch.
- User impact:
  - Dry-run output can be noisier and less trustworthy as a no-op check.
- Repro:
  1. Ensure clients are in sync.
  2. Run `sync --dry-run`.
  3. Observe behavior differs from normal no-op sync.
- Recommended fix:
  - Apply no-op short-circuit consistently in dry-run mode.

### SYNC-08 - Sync always performs source pull into master (if source set)

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - Sync is not push-only by default; it mutates master from source first.
- User impact:
  - Users expecting pure "push master to clients" may be surprised.
- Repro:
  1. Set source and introduce differences in source.
  2. Run `sync`.
  3. Observe source data merged into master before writes.
- Recommended fix:
  - Add `--no-source-pull` or make this stage explicit and optional.

### SYNC-09 - Watch daemon auto-runs sync with auto-approval

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - Watch scheduler calls `syncCommand({ dryRun: false, yes: true })`.
- User impact:
  - Any config file change triggers full apply without per-change confirmation.
- Repro:
  1. Run `synctax watch`.
  2. Save config.
  3. Observe immediate sync execution path with `yes: true`.
- Recommended fix:
  - Add watch safety modes (`--dry-run`, `--prompt`, `--clients`) and clearer startup warning.

### SYNC-10 - `--strict-env` option is currently unused

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/sync.ts`, `bin/synctax.ts`
- Problem:
  - CLI exposes `--strict-env`, but sync logic does not enforce it.
- User impact:
  - Users may assume stronger env safety than implemented.
- Repro:
  1. Run with `--strict-env`.
  2. Inspect behavior and code path; no strict-env branch.
- Recommended fix:
  - Implement enforcement or remove option until implemented.

### SYNC-11 - No target-client filtering option on `sync`

- Severity: Feature Gap (Medium)
- Status: Confirmed
- Evidence: `bin/synctax.ts`, `src/commands/sync.ts`
- Problem:
  - Sync applies to all enabled non-source clients; no `--client` narrowing.
- User impact:
  - Reduced control during incident response or staged rollout.
- Repro:
  1. Try to sync only one client via CLI flags.
  2. No direct option exists.
- Recommended fix:
  - Add repeatable `--client <id>` filter.

### SYNC-12 - Watch only monitors master config file

- Severity: Feature Gap (Medium)
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - Watch tracks `~/.synctax/config.json` changes only.
- User impact:
  - Direct client-side edits are not automatically detected/reconciled.
- Repro:
  1. Run watch.
  2. Edit client-native config directly.
  3. No watch trigger unless master config changes.
- Recommended fix:
  - Offer optional client-file watch + pull/reconcile mode.

### SYNC-13 - Memory sync is one-way overwrite (no conflict handling)

- Severity: Feature Gap (Medium)
- Status: Confirmed
- Evidence: `src/commands/sync.ts` (`memorySyncCommand`)
- Problem:
  - Reads one source memory file and writes same content to all targets.
- User impact:
  - Local target edits can be overwritten without merge/conflict visibility.
- Repro:
  1. Diverge memory files across clients.
  2. Run `memory-sync`.
  3. Observe source content overwrites targets.
- Recommended fix:
  - Add preview/conflict summary or opt-in merge strategy.

### SYNC-14 - Pull has no dry-run capability

- Severity: Feature Gap (Medium)
- Status: Confirmed
- Evidence: `bin/synctax.ts`, `src/commands/pull.ts`
- Problem:
  - Pull merges/overwrites without a "show changes only" mode.
- User impact:
  - Higher risk for cautious users and CI check workflows.
- Repro:
  1. Run pull with expected differences.
  2. No native dry-run preview.
- Recommended fix:
  - Add `pull --dry-run` with domain/resource diff summary.

---

## C) Security and Compliance

### SEC-01 - Export writes full master config, including sensitive fields

- Severity: High
- Status: Confirmed
- Evidence: `src/commands/io.ts`, `src/types.ts`
- Problem:
  - `exportCommand` writes full JSON config payload.
  - Config schema allows credentials and MCP env/header values.
- User impact:
  - Secret leakage risk when sharing/exporting files.
- Repro:
  1. Add credentials or MCP env/header literals in master config.
  2. Run `synctax export`.
  3. Observe sensitive values in output file.
- Recommended fix:
  - Default to redacted export; provide explicit `--full` override.

### SEC-02 - TUI export description claims credentials are stripped

- Severity: Medium
- Status: Confirmed
- Evidence: `src/tui/actions.ts`, `src/commands/io.ts`
- Problem:
  - TUI action text says full export strips credentials.
  - Actual export command writes full config.
- User impact:
  - Direct trust gap and potential accidental secret exposure.
- Repro:
  1. Use TUI export quick action.
  2. Compare exported content to action description.
- Recommended fix:
  - Align implementation with description, or correct text immediately.

### SEC-03 - Profile include/exclude filtering does not apply to permissions/models/prompts

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/_shared.ts`, `src/commands/profile.ts`
- Problem:
  - `applyProfileFilter` filters only mcps/agents/skills.
  - `profilePublishCommand` exports filtered permissions/models/prompts unchanged.
- User impact:
  - Shared profiles can unintentionally carry broader policy/prompt data.
- Repro:
  1. Create profile with include/exclude resource names.
  2. Publish profile.
  3. Observe permissions/models/prompts still included.
- Recommended fix:
  - Either filter these domains too or document explicit "always included" behavior.

### SEC-04 - Master config file permissions default to 0644

- Severity: Medium
- Status: Confirmed
- Evidence: `src/config.ts`, `src/fs-utils.ts`
- Problem:
  - `ConfigManager.write` uses `atomicWriteFile` default mode `0o644`.
- User impact:
  - Weaker secret hygiene on shared Unix environments.
- Repro:
  1. Write config on Unix.
  2. Inspect file mode.
- Recommended fix:
  - Use secure write mode (`0o600`) for master config.

### SEC-05 - Profile pull has no URL hardening/integrity validation

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/profile.ts`
- Problem:
  - `profilePullCommand` does raw `fetch(url)` with no protocol/host constraints, checksum, signature, or size guardrails.
- User impact:
  - Increased risk from malicious/untrusted endpoints and oversized payloads.
- Repro:
  1. Pull from arbitrary URL.
  2. Observe acceptance solely based on JSON shape.
- Recommended fix:
  - Add HTTPS-only default, host allowlist option, max response size, and optional signature/checksum verification.

### SEC-06 - Profile pull collisions overwrite existing resources automatically

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/profile.ts`
- Problem:
  - Collisions are warned, then incoming resources overwrite existing definitions.
- User impact:
  - High chance of accidental policy/config replacement.
- Repro:
  1. Prepare overlapping resource names.
  2. Run profile pull.
  3. Observe warning then overwrite.
- Recommended fix:
  - Add collision strategy flags: `--abort-on-collision`, `--skip-collisions`, `--overwrite`.

### SEC-07 - Pull data model carries credentials but merge logic ignores them

- Severity: Medium
- Status: Confirmed
- Evidence: `src/commands/pull.ts`
- Problem:
  - Interactive selection path keeps `credentials` in `toMerge`.
  - Final merge/overwrite blocks never apply credentials.
- User impact:
  - Inconsistent domain behavior and operator confusion.
- Repro:
  1. Pull from source that returns credentials.
  2. Observe no credentials merge behavior in final write logic.
- Recommended fix:
  - Decide domain policy explicitly: merge credentials with safeguards, or remove from pull data contract.

### SEC-08 - Source client is implicitly trusted for master mutation during sync

- Severity: Inferred Risk (Medium)
- Status: Confirmed behavior, inferred risk
- Evidence: `src/commands/sync.ts`
- Problem:
  - Source data is merged into master before writes without explicit per-run trust confirmation.
- User impact:
  - Compromised/misconfigured source can pollute master state.
- Repro:
  1. Set source client.
  2. Modify source client unexpectedly.
  3. Run sync and observe merge into master.
- Recommended fix:
  - Add trust controls: `--no-source-pull`, hash/preview gate, or explicit source-pull confirmation in risky contexts.

### SEC-09 - Status/doctor lack JSON output mode for compliance automation

- Severity: Feature Gap (Low)
- Status: Confirmed
- Evidence: `bin/synctax.ts`, `src/commands/info.ts`
- Problem:
  - `profile list/diff` support JSON, but status/doctor do not.
- User impact:
  - Harder to enforce CI compliance checks and machine-readable health gating.
- Repro:
  1. Try `status --json` or `doctor --json`.
  2. No supported mode.
- Recommended fix:
  - Add structured JSON output and stable schema for automation.

---

## D) TUI and Interactive UX (Power-User Focus)

### TUI-01 - Dashboard drift and last-sync values are placeholders

- Severity: High
- Status: Confirmed
- Evidence: `src/tui/data.ts`
- Problem:
  - TUI frame data hardcodes `driftClients: 0` and `lastSync: "unknown"`.
- User impact:
  - Health panel can communicate false confidence.
- Repro:
  1. Ensure client drift exists.
  2. Open TUI dashboard.
  3. Drift indicators do not reflect actual state.
- Recommended fix:
  - Hydrate drift and sync metadata from real checks or mark explicitly as unknown with action hint.

### TUI-02 - Quick action surfaces hide non-numeric hotkeys (`!`, `@`)

- Severity: Medium
- Status: Confirmed
- Evidence: `src/tui/components/QuickActions.tsx`, `src/tui/components/HelpOverlay.tsx`, `src/tui/actions.ts`
- Problem:
  - Restore/export actions exist with hotkeys but are filtered out from displayed quick-action lists.
- User impact:
  - Reduced discoverability of recovery/export operations.
- Repro:
  1. Open TUI and help.
  2. Observe quick-action display limited to numeric keys.
- Recommended fix:
  - Include non-numeric action keys in quick/help views.

### TUI-03 - Command palette search ignores action descriptions

- Severity: Medium
- Status: Confirmed
- Evidence: `src/tui/components/CommandPalette.tsx`
- Problem:
  - Filter uses label/command/id only.
- User impact:
  - Harder "intent-based" lookup for users who remember purpose but not command token.
- Repro:
  1. Search by text present in description only.
  2. No expected match.
- Recommended fix:
  - Include `description` field in filter logic.

### TUI-04 - Interactive mode has no explicit `exit` command entry

- Severity: Low
- Status: Confirmed
- Evidence: `src/interactive.ts`
- Problem:
  - Exit relies on prompt cancellation path, not explicit command choice.
- User impact:
  - Lower clarity for keyboard-first operators and scripts around prompt behavior.
- Repro:
  1. Open interactive mode.
  2. Check command list; no explicit exit item.
- Recommended fix:
  - Add `exit`/`quit` command in menu with clean return path.

### TUI-05 - Interactive move flow supports only global/local scope moves

- Severity: Medium
- Status: Confirmed
- Evidence: `src/interactive.ts`
- Problem:
  - Prompt options expose only `toGlobal` and `toLocal`.
- User impact:
  - Scope control in interactive mode is narrower than broader scope model.
- Repro:
  1. Run interactive `move`.
  2. Scope choices are limited.
- Recommended fix:
  - Extend interactive move choices to full supported scope set or clarify intended scope subset.

### TUI-06 - Status bar clock is disabled on Windows

- Severity: Low
- Status: Confirmed
- Evidence: `src/tui/components/StatusBar.tsx`
- Problem:
  - Time display intentionally blanked on `win32`.
- User impact:
  - Cross-platform UI inconsistency.
- Repro:
  1. Open TUI on Windows and non-Windows.
  2. Compare status bar clock behavior.
- Recommended fix:
  - Re-enable with Windows-safe formatting fallback.

### TUI-07 - Watch startup banner includes emoji

- Severity: Inferred Risk (Low)
- Status: Confirmed behavior, inferred risk
- Evidence: `src/commands/sync.ts`
- Problem:
  - Watch startup log uses emoji symbol.
- User impact:
  - Possible rendering/parse noise in constrained terminals and plain log pipelines.
- Repro:
  1. Run watch in basic terminal/log sink.
  2. Observe non-ASCII banner rendering.
- Recommended fix:
  - Add plain-text/no-emoji mode or default to plain ASCII in daemon output.

### TUI-08 - "Quit during execution" messaging is behaviorally ambiguous

- Severity: Inferred Risk (Low)
- Status: Confirmed text/handler mismatch, runtime effect inferred
- Evidence: `src/tui/components/HelpOverlay.tsx`, `src/tui/components/App.tsx`
- Problem:
  - Help says quit while action completes in background.
  - Global `q` exits app immediately; exact background completion semantics are not explicit.
- User impact:
  - Uncertainty during long-running operations.
- Repro:
  1. Start long action in TUI.
  2. Press `q`.
  3. Verify whether operation fully completes; behavior can feel unclear.
- Recommended fix:
  - Make behavior explicit and consistent (confirm-on-quit or documented detach semantics).

---

## E) Cross-Platform and Environment-Consistency Findings

### XPLAT-01 - Windows VS Code path candidate logic can skip real `%APPDATA%` paths under custom `SYNCTAX_HOME`

- Severity: High
- Status: Confirmed
- Evidence: `src/platform-paths.ts`
- Problem:
  - Candidate logic only uses `%APPDATA%` when it is under `SYNCTAX_HOME`.
  - With portable/custom `SYNCTAX_HOME`, real VS Code user files may be excluded.
- User impact:
  - Detection/sync can silently miss actual user config on Windows.
- Repro:
  1. Set `SYNCTAX_HOME` outside `%APPDATA%`.
  2. Keep real VS Code config in `%APPDATA%`.
  3. Observe candidate selection omits real paths.
- Recommended fix:
  - Always include standard OS user paths, then apply scope/priority rules separately.

### XPLAT-02 - PATH install home root is inconsistent with config home root

- Severity: Medium
- Status: Confirmed
- Evidence: `src/install-path.ts`, `src/config.ts`
- Problem:
  - Install path uses `os.homedir()`.
  - Config manager uses `SYNCTAX_HOME || os.homedir()`.
- User impact:
  - Launcher path and config path can diverge in custom-home setups.
- Repro:
  1. Set `SYNCTAX_HOME` to non-default location.
  2. Run init + path setup.
  3. Observe launcher and config rooted differently.
- Recommended fix:
  - Use one canonical home resolver across install/config/watch/lock flows.

### XPLAT-03 - Fish PATH block hardcodes `$HOME/.synctax/bin`

- Severity: Medium
- Status: Confirmed
- Evidence: `src/install-path.ts`
- Problem:
  - Fish path snippet does not honor custom `SYNCTAX_HOME`.
- User impact:
  - Broken command discovery in fish for non-default homes.
- Repro:
  1. Use fish with custom `SYNCTAX_HOME`.
  2. Run path installer.
  3. Observe hardcoded HOME-based path entry.
- Recommended fix:
  - Generate fish PATH statement from resolved Synctax home directory.

### XPLAT-04 - Symlink-based link flow can fail on Windows without proper privileges

- Severity: Inferred Risk (Medium)
- Status: Confirmed symlink strategy, inferred platform risk
- Evidence: `src/commands/link.ts`
- Problem:
  - Link feature uses `fs.symlink(...)` directly.
- User impact:
  - Windows users without Developer Mode/elevation can hit permission errors.
- Repro:
  1. Run `synctax link` on locked-down Windows machine.
  2. Observe potential symlink permission failure.
- Recommended fix:
  - Add Windows fallback (`junction`/copy mode) and actionable error guidance.

### XPLAT-05 - Watch path and daemon UX are tied to single config location assumption

- Severity: Feature Gap (Low)
- Status: Confirmed
- Evidence: `src/commands/sync.ts`
- Problem:
  - Watch resolves one config path and does not expose custom watch targets.
- User impact:
  - Reduced flexibility for multi-root or advanced environment setups.
- Repro:
  1. Attempt monitoring alternate config roots without env switching.
  2. No native option.
- Recommended fix:
  - Add optional `--config` or `--watch-path` parameter.

---

## Priority Remediation Plan

### P0 (Immediate)

1. Fix dry-run mutation bug (`SYNC-01`).
2. Fix PATH installer entrypoint mismatch (`ONB-01`).
3. Add safe/redacted export defaults and align TUI copy (`SEC-01`, `SEC-02`).
4. Fix Windows custom-home candidate omission (`XPLAT-01`).
5. Correct doctor false-pass behavior and branding (`ONB-07`, `ONB-08`).

### P1 (Next)

1. Standardize backup+lock policies for all master writes (`SYNC-02`, `SYNC-03`).
2. Clarify source-pull semantics and add opt-out (`SYNC-08`).
3. Expand diff/plan coverage beyond three domains (`SYNC-06`).
4. Add TUI setup/init and improve quick-action discoverability (`ONB-03`, `TUI-02`, `TUI-03`).
5. Implement or remove `--strict-env` (`SYNC-10`).

### P2 (Roadmap)

1. Add pull dry-run and sync client targeting (`SYNC-11`, `SYNC-14`).
2. Add watch/client reverse-sync strategies (`SYNC-12`).
3. Improve memory-sync conflict visibility (`SYNC-13`).
4. Strengthen profile pull integrity/collision controls (`SEC-05`, `SEC-06`).
5. Add machine-readable status/doctor output (`SEC-09`).

---

## External UX Standards Used for Expectation Baselines

- NN/g 10 Usability Heuristics:
  - Visibility of system status
  - Error prevention
  - User control and freedom
  - Help and documentation
- Microsoft command-line guidance:
  - Consistent option behavior
  - Predictable command semantics
  - Script-safe and compatibility-friendly UX
- CLI Guidelines (`clig.dev`):
  - Dry-run trustworthiness
  - Actionable error output
  - Discoverability and next-step guidance
  - Human-first but automation-friendly CLI behavior