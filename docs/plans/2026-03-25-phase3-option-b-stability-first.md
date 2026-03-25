# Phase 3 Option B (Stability-First) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize existing `status` + profile behavior first, then implement Phase 3 core features with automated tests and a repeatable smoke checklist.

**Architecture:** Execute in two gates. Gate 1 is sequential hardening (status correctness, profile semantics, profile UX). Gate 2 is Phase 3 command delivery (diff, validate, rollback, link/unlink, doctor deep, add-from-url) with integration wiring and verification. Keep shared logic in command-level helpers to avoid adapter churn.

**Tech Stack:** Bun, TypeScript (ESM), Commander.js, Zod, Vitest, `@inquirer/prompts`, `fs/promises`.

---

## Option B Delivery Model

1. **Gate 1 (Sequential, mandatory):** status + profile hardening.
2. **Gate 2 (Build phase):** implement Phase 3 feature set.
3. **Verification:** automated tests + manual smoke matrix for all commands.

Do not start Gate 2 until Gate 1 is green.

---

### Task 1: Add Status Regression Tests First

**Files:**
- Create: `tests/status.test.ts`
- Modify: `tests/interactive.test.ts`

**Step 1: Write the failing tests**

```ts
it("does not report unsupported domains as drift", async () => {
  // setup config with skills/agents + zed enabled
  // status should not mark zed out-of-sync for missing skills/agents
});

it("treats semantically equal resources as in-sync", async () => {
  // env key order differs between master/client read output
  // should still be in-sync
});

it("detects extra resources in client", async () => {
  // client has resource absent in master
  // status should report drift
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/status.test.ts -v`

Expected: FAIL for current `JSON.stringify` + one-way comparison logic.

**Step 3: Minimal implementation scaffold**

```ts
// in src/commands/info.ts
const SUPPORTED_DOMAINS: Record<string, Array<"mcps" | "agents" | "skills">> = {
  zed: ["mcps"],
  cline: ["mcps"],
  "gemini-cli": [],
};
```

**Step 4: Re-run test**

Run: `bunx vitest run tests/status.test.ts -v`

Expected: still failing until Task 2 implementation lands.

**Step 5: Commit test-first scaffold**

```bash
git add tests/status.test.ts tests/interactive.test.ts
git commit -m "test: add status regression coverage for drift detection"
```

---

### Task 2: Fix `statusCommand` Drift Logic

**Files:**
- Modify: `src/commands/info.ts`
- Test: `tests/status.test.ts`

**Step 1: Keep tests red, then implement**

```ts
function normalizeComparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeComparable);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (key === "scope") continue;
      out[key] = normalizeComparable(obj[key]);
    }
    return out;
  }
  return value;
}
```

**Step 2: Add bidirectional drift checks**

```ts
// master -> client (missing/changed)
// client -> master (extra)
```

**Step 3: Add domain-capability gating before compare**

```ts
const supported = SUPPORTED_DOMAINS[id] ?? ["mcps", "agents", "skills"];
```

**Step 4: Run tests**

Run: `bunx vitest run tests/status.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/info.ts tests/status.test.ts
git commit -m "fix: make status drift checks capability-aware and normalized"
```

---

### Task 3: Add Profile Resolver Tests (`extends`, cycles, precedence)

**Files:**
- Create: `tests/profile-resolver.test.ts`
- Test: `tests/profiles.test.ts`

**Step 1: Write failing tests**

```ts
it("resolves extends chain with child precedence", async () => {
  // base -> child -> grandchild
});

it("throws on circular extends", async () => {
  // a -> b -> a
});

it("applyProfileFilter uses resolved profile", async () => {
  // inherited include/exclude impacts sync set
});
```

**Step 2: Run test to verify failure**

Run: `bunx vitest run tests/profile-resolver.test.ts tests/profiles.test.ts -v`

Expected: FAIL (no resolver exists yet).

**Step 3: Add resolver signatures first**

```ts
export function resolveProfile(profiles: Record<string, any>, name: string): any {}
export async function applyProfileFilter(resources: any, profile: any): Promise<any> {}
```

**Step 4: Re-run test**

Run: `bunx vitest run tests/profile-resolver.test.ts tests/profiles.test.ts -v`

Expected: still failing until Task 4 logic implemented.

**Step 5: Commit tests first**

```bash
git add tests/profile-resolver.test.ts tests/profiles.test.ts
git commit -m "test: add profile inheritance and cycle detection coverage"
```

---

### Task 4: Implement Profile Resolver and Integrate with Sync

**Files:**
- Modify: `src/commands/_shared.ts`
- Modify: `src/commands/sync.ts`
- Test: `tests/profile-resolver.test.ts`

**Step 1: Implement resolver logic**

```ts
export function resolveProfile(profiles: Record<string, any>, name: string) {
  const seen = new Set<string>();
  function walk(current: string): any {
    if (seen.has(current)) throw new Error(`Circular profile extends: ${current}`);
    seen.add(current);
    const p = profiles[current] || {};
    const base = p.extends ? walk(p.extends) : {};
    return {
      include: p.include ?? base.include,
      exclude: p.exclude ?? base.exclude,
      extends: p.extends,
    };
  }
  return walk(name);
}
```

**Step 2: Use resolved profile in sync path**

```ts
const resolvedProfile = resolveProfile(config.profiles, config.activeProfile);
let resources = await applyProfileFilter(config.resources, resolvedProfile);
```

**Step 3: Run tests**

Run: `bunx vitest run tests/profile-resolver.test.ts tests/profiles.test.ts -v`

Expected: PASS.

**Step 4: Run impacted regression tests**

Run: `bunx vitest run tests/commands.test.ts tests/premium-cli.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/_shared.ts src/commands/sync.ts tests/profile-resolver.test.ts tests/profiles.test.ts
git commit -m "feat: implement profile extends resolution with cycle guards"
```

---

### Task 5: Add `profile list`

**Files:**
- Modify: `src/commands/profile.ts`
- Modify: `src/commands/index.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`
- Test: `tests/profiles.test.ts`

**Step 1: Write failing test**

```ts
it("profile list shows active marker and counts", async () => {
  // expect default marked active and total profile count printed
});
```

**Step 2: Run test (red)**

Run: `bunx vitest run tests/profiles.test.ts -t "profile list" -v`

Expected: FAIL (command missing).

**Step 3: Implement command + wiring**

```ts
export async function profileListCommand(options?: { json?: boolean }) {
  // read config, print active profile marker, include/exclude summaries
}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/profiles.test.ts tests/interactive.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/profile.ts src/commands/index.ts bin/synctax.ts src/interactive.ts tests/profiles.test.ts tests/interactive.test.ts
git commit -m "feat: add profile list command with cli and interactive wiring"
```

---

### Task 6: Add `profile diff <name>`

**Files:**
- Create: `tests/profile-diff.test.ts`
- Modify: `src/commands/profile.ts`
- Modify: `src/commands/index.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`

**Step 1: Write failing test**

```ts
it("profile diff shows included and excluded resources", async () => {
  // compares resolved profile effect against full resources
});
```

**Step 2: Run test (red)**

Run: `bunx vitest run tests/profile-diff.test.ts -v`

Expected: FAIL.

**Step 3: Implement minimal command**

```ts
export async function profileDiffCommand(name: string, options?: { json?: boolean }) {
  // resolve profile -> apply filter -> compute included/excluded names by domain
}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/profile-diff.test.ts tests/profiles.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/profile-diff.test.ts src/commands/profile.ts src/commands/index.ts bin/synctax.ts src/interactive.ts
git commit -m "feat: add profile diff command for resolved profile preview"
```

---

### Task 7: Harden Profile Pull/Publish Round-Trip

**Files:**
- Modify: `src/commands/profile.ts`
- Modify: `tests/commands.test.ts`

**Step 1: Add failing tests**

```ts
it("profile pull validates payload and merges supported domains", async () => {
  // invalid payload should fail; valid should merge mcps/agents/skills/permissions/models/prompts
});

it("profile publish and pull preserve profile shape (without credentials)", async () => {
  // round-trip check
});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/commands.test.ts -t "profile pull|profile publish" -v`

Expected: FAIL.

**Step 3: Implement validation + symmetric merge**

```ts
if (payload.resources.permissions) config.resources.permissions = mergePermissions(config.resources.permissions, payload.resources.permissions);
if (payload.resources.models) config.resources.models = { ...config.resources.models, ...payload.resources.models };
if (payload.resources.prompts) config.resources.prompts = { ...config.resources.prompts, ...payload.resources.prompts };
```

**Step 4: Run tests**

Run: `bunx vitest run tests/commands.test.ts -t "profile pull|profile publish" -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/profile.ts tests/commands.test.ts
git commit -m "fix: harden profile pull/publish with validation and round-trip consistency"
```

---

## Gate 1 Exit Criteria

- `tests/status.test.ts` green
- profile resolver/list/diff tests green
- `commands.test.ts` profile pull/publish tests green
- `bunx tsc --noEmit` green

---

### Task 8: Implement `synctax diff [client]`

**Files:**
- Create: `src/commands/diff.ts`
- Create: `tests/diff.test.ts`
- Modify: `src/commands/index.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`

**Step 1: Write failing tests**

```ts
it("diff shows add/remove/modify for all enabled clients", async () => {});
it("diff supports single client", async () => {});
it("diff supports --json", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/diff.test.ts -v`

Expected: FAIL.

**Step 3: Implement command**

```ts
export async function diffCommand(clientId?: string, options?: { json?: boolean }) {
  // read master + adapter.read, compare mcps/agents/skills, print or return json
}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/diff.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/diff.ts tests/diff.test.ts src/commands/index.ts bin/synctax.ts src/interactive.ts
git commit -m "feat: add diff command with json output"
```

---

### Task 9: Implement `synctax validate`

**Files:**
- Create: `src/commands/validate.ts`
- Create: `tests/validate.test.ts`
- Modify: `src/commands/index.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`

**Step 1: Write failing tests**

```ts
it("validate checks schema, client detect, env refs, commands on PATH, active profile", async () => {});
it("validate returns non-zero semantics for hard errors", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/validate.test.ts -v`

Expected: FAIL.

**Step 3: Implement command**

```ts
export async function validateCommand(options?: { strict?: boolean }): Promise<boolean> {
  // emit checks; return healthy boolean
}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/validate.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/validate.ts tests/validate.test.ts src/commands/index.ts bin/synctax.ts src/interactive.ts
git commit -m "feat: add validate command for config integrity checks"
```

---

### Task 10: Add Sync Snapshot + Rollback

**Files:**
- Modify: `src/commands/sync.ts`
- Create: `tests/sync-rollback.test.ts`

**Step 1: Write failing rollback tests**

```ts
it("rolls back previously synced clients when a later write fails", async () => {});
it("reports rollback failures without retry loop", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/sync-rollback.test.ts -v`

Expected: FAIL.

**Step 3: Implement rollback algorithm**

```ts
const snapshots = new Map<string, any>();
const synced: string[] = [];
// read snapshots -> write sequentially -> on failure rollback synced clients
```

**Step 4: Run tests**

Run: `bunx vitest run tests/sync-rollback.test.ts tests/profiles.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/sync.ts tests/sync-rollback.test.ts
git commit -m "feat: make sync atomic with snapshot rollback on failure"
```

---

### Task 11: Add `link` / `unlink`

**Files:**
- Create: `src/commands/link.ts`
- Create: `tests/link.test.ts`
- Modify: `src/commands/index.ts`
- Modify: `bin/synctax.ts`
- Modify: `src/interactive.ts`

**Step 1: Write failing tests**

```ts
it("link creates canonical instructions file and symlinks client memory files", async () => {});
it("unlink restores regular files with preserved content", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/link.test.ts -v`

Expected: FAIL.

**Step 3: Implement commands**

```ts
export async function linkCommand() {}
export async function unlinkCommand() {}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/link.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/link.ts tests/link.test.ts src/commands/index.ts bin/synctax.ts src/interactive.ts
git commit -m "feat: add link and unlink commands for shared instruction symlinks"
```

---

### Task 12: Add `doctor --deep`

**Files:**
- Modify: `src/commands/info.ts`
- Modify: `tests/commands.test.ts`
- Modify: `bin/synctax.ts`

**Step 1: Write failing tests**

```ts
it("doctor --deep validates MCP commands and required env vars", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/commands.test.ts -t "doctor --deep" -v`

Expected: FAIL.

**Step 3: Implement deep checks**

```ts
if (options.deep) {
  // check command existence + env refs for each MCP
}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/commands.test.ts -t "doctor" -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/info.ts tests/commands.test.ts bin/synctax.ts
git commit -m "feat: add deep mcp health checks to doctor command"
```

---

### Task 13: Add `add mcp <name> --from <url>`

**Files:**
- Modify: `src/commands/manage.ts`
- Modify: `tests/commands.test.ts`
- Modify: `bin/synctax.ts`

**Step 1: Write failing tests**

```ts
it("add mcp --from imports mcp from url payload", async () => {});
it("add mcp --from rejects invalid json and invalid schema", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/commands.test.ts -t "add mcp --from" -v`

Expected: FAIL.

**Step 3: Implement URL import flow**

```ts
if (domain === "mcp" && options.from) {
  const response = await fetch(options.from);
  const payload = await response.json();
  // support raw mcp object and { mcps: { name: ... } }
}
```

**Step 4: Run tests**

Run: `bunx vitest run tests/commands.test.ts -t "add mcp --from" -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/manage.ts tests/commands.test.ts bin/synctax.ts
git commit -m "feat: support adding mcp resources from remote url"
```

---

### Task 14: Integration Wiring + Full Regression

**Files:**
- Modify: `src/commands/index.ts`
- Modify: `src/interactive.ts`
- Modify: `tests/interactive.test.ts`
- Modify: `tests/premium-cli.test.ts`

**Step 1: Add failing wiring tests**

```ts
it("interactive command palette dispatches new commands", async () => {});
it("new commands print brand header and summary", async () => {});
```

**Step 2: Run tests (red)**

Run: `bunx vitest run tests/interactive.test.ts tests/premium-cli.test.ts -v`

Expected: FAIL.

**Step 3: Wire missing exports, CLI commands, and interactive entries**

```ts
// add exports and command registrations for diff/validate/link/unlink/profile list/profile diff
```

**Step 4: Run tests**

Run: `bunx vitest run tests/interactive.test.ts tests/premium-cli.test.ts -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/index.ts src/interactive.ts tests/interactive.test.ts tests/premium-cli.test.ts bin/synctax.ts
git commit -m "chore: wire phase3 and profile commands across cli and interactive mode"
```

---

### Task 15: Final Verification + Smoke Matrix

**Files:**
- Create: `docs/qa/2026-03-25-phase3-smoke-checklist.md`

**Step 1: Add smoke checklist document**

```md
# Phase 3 Smoke Checklist

- bun ./bin/synctax.ts status
- bun ./bin/synctax.ts diff
- bun ./bin/synctax.ts validate
- bun ./bin/synctax.ts doctor --deep
- bun ./bin/synctax.ts profile list
- bun ./bin/synctax.ts profile diff default
- bun ./bin/synctax.ts link
- bun ./bin/synctax.ts unlink
```

**Step 2: Run full automated verification**

Run: `bun run test`

Expected: PASS for entire suite.

**Step 3: Run type-check**

Run: `bunx tsc --noEmit`

Expected: PASS.

**Step 4: Execute smoke checklist commands manually**

Run each command in `docs/qa/2026-03-25-phase3-smoke-checklist.md`.

Expected: No crashes, correct summaries, expected warnings/errors.

**Step 5: Commit verification artifacts**

```bash
git add docs/qa/2026-03-25-phase3-smoke-checklist.md
git commit -m "docs: add phase3 smoke checklist and verification flow"
```

---

## Definition of Done

- Gate 1 completed before Gate 2 starts.
- New commands exist and are wired in CLI + interactive mode.
- Status drift reporting is accurate (no known false positives from unsupported domains).
- Profile system supports seamless create/use/list/diff with `extends` and cycle protection.
- Full test suite and type-check are green.
- Smoke checklist passes end-to-end.
