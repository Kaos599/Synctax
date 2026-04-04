# Synctax v3: Safety Hardening, Init Fixes, and Bug Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Synctax safe against data corruption (atomic writes, file locks, validation), fix the init source selection UX, fix the profile publish data leak, and add env vault safety warnings.

**Architecture:** Three layers of change: (1) New shared utilities (`fs-utils.ts`, `lock.ts`) that all adapters and commands consume, (2) Targeted fixes to `init.ts`, `sync.ts`, `env-vault.ts`, and `profile.ts`, (3) Test coverage for every safety-critical path. Changes are additive — no existing APIs change signature, only internal implementation.

**Tech Stack:** TypeScript (Bun runtime), Vitest, Node.js `fs/promises`, `@inquirer/prompts` (select).

**Spec reference:** `docs/specs/2026-04-01-synctax-v3-design.md` Sections 2, 3.1-3.9, 3.11

**Test runner:** `bunx vitest run` (all tests), `bunx vitest run tests/<file>` (single file), `bunx vitest run -t "<name>"` (by pattern)

**Existing test baseline:** 46 suites, 433 tests, all passing.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/fs-utils.ts` | Create | `atomicWriteFile()` and `atomicWriteSecure()` helpers |
| `src/lock.ts` | Create | File-based exclusive lock with stale detection |
| `tests/fs-utils.test.ts` | Create | Tests for atomic write and secure write |
| `tests/lock.test.ts` | Create | Tests for lock acquire, release, stale detection, contention |
| `src/config.ts` | Modify | Use `atomicWriteFile` in `write()`, validate before write |
| `src/env-vault.ts` | Modify | Add `process.env` fallback warning in `resolveEnvValue()` |
| `src/commands/sync.ts` | Modify | Add snapshot failure warnings, lock acquisition, `--strict-env` plumbing |
| `src/commands/init.ts` | Modify | Replace silent source default with interactive prompt |
| `src/commands/profile.ts` | Modify | Fix `profilePublishCommand` to filter resources by profile, add collision warnings to `profilePullCommand` |
| `src/tui/entry.ts` | Modify | Log message when viewport is too small for TUI |
| `bin/synctax.ts` | Modify | Add `--yes` and `--strict-env` flags to sync command |
| `tests/config.test.ts` | Modify | Add test for validate-before-write |
| `tests/env-vault.test.ts` | Modify | Add tests for process.env fallback warning |
| `tests/commands.test.ts` | Modify | Add tests for init source prompt, snapshot warnings |
| `tests/profiles.test.ts` | Modify | Add tests for profile publish filtering and collision detection |

---

### Task 1: Create `src/fs-utils.ts` — Atomic Write Helpers

**Files:**
- Create: `src/fs-utils.ts`
- Create: `tests/fs-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/fs-utils.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { atomicWriteFile, atomicWriteSecure } from "../src/fs-utils.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-fs-utils-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("atomicWriteFile", () => {
  it("writes content to the target file", async () => {
    const target = path.join(tmpDir, "test.json");
    await atomicWriteFile(target, '{"ok":true}');
    const content = await fs.readFile(target, "utf-8");
    expect(content).toBe('{"ok":true}');
  });

  it("does not leave a temp file behind on success", async () => {
    const target = path.join(tmpDir, "test.json");
    await atomicWriteFile(target, "hello");
    const files = await fs.readdir(tmpDir);
    expect(files).toEqual(["test.json"]);
  });

  it("creates parent directories if missing", async () => {
    const target = path.join(tmpDir, "nested", "deep", "config.json");
    await atomicWriteFile(target, "nested");
    const content = await fs.readFile(target, "utf-8");
    expect(content).toBe("nested");
  });

  it("overwrites an existing file atomically", async () => {
    const target = path.join(tmpDir, "test.json");
    await fs.writeFile(target, "old", "utf-8");
    await atomicWriteFile(target, "new");
    const content = await fs.readFile(target, "utf-8");
    expect(content).toBe("new");
  });
});

describe("atomicWriteSecure", () => {
  it("writes with mode 0o600", async () => {
    const target = path.join(tmpDir, "secret.env");
    await atomicWriteSecure(target, "SECRET=value");
    const stat = await fs.stat(target);
    // Check owner-only permissions (mask out file type bits)
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/fs-utils.test.ts`
Expected: FAIL — module `../src/fs-utils.js` not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/fs-utils.ts
import fs from "fs/promises";
import path from "path";

/**
 * Write a file atomically: write to a temp file in the same directory,
 * then rename() into place. rename() is atomic on POSIX when source
 * and target are on the same filesystem.
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string,
  mode?: number,
): Promise<void> {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});

  const tempPath = targetPath + ".synctax-tmp";
  await fs.writeFile(tempPath, content, {
    encoding: "utf-8",
    mode: mode ?? 0o644,
  });
  await fs.rename(tempPath, targetPath);
}

/**
 * Write sensitive files with owner-only permissions (0o600).
 */
export async function atomicWriteSecure(
  targetPath: string,
  content: string,
): Promise<void> {
  await atomicWriteFile(targetPath, content, 0o600);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/fs-utils.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `bunx vitest run`
Expected: All 438+ tests PASS (433 existing + 5 new)

- [ ] **Step 6: Commit**

```bash
git add src/fs-utils.ts tests/fs-utils.test.ts
git commit -m "feat(safety): add atomicWriteFile and atomicWriteSecure utilities

Writes to a .synctax-tmp file then renames into place, preventing
corrupted config files if the process crashes mid-write."
```

---

### Task 2: Create `src/lock.ts` — Exclusive File Lock

**Files:**
- Create: `src/lock.ts`
- Create: `tests/lock.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lock.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { acquireLock } from "../src/lock.js";

let mockHome: string;

beforeEach(async () => {
  mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-lock-"));
  process.env.SYNCTAX_HOME = mockHome;
  // Ensure .synctax dir exists
  await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(mockHome, { recursive: true, force: true });
  delete process.env.SYNCTAX_HOME;
});

describe("acquireLock", () => {
  it("creates a lock file on acquire", async () => {
    const lock = await acquireLock("test");
    const lockPath = path.join(mockHome, ".synctax", "sync.lock");
    const exists = await fs.access(lockPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    await lock.release();
  });

  it("removes the lock file on release", async () => {
    const lock = await acquireLock("test");
    await lock.release();
    const lockPath = path.join(mockHome, ".synctax", "sync.lock");
    const exists = await fs.access(lockPath).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it("throws when lock is already held", async () => {
    const lock1 = await acquireLock("first");
    await expect(acquireLock("second")).rejects.toThrow(/Another synctax process/);
    await lock1.release();
  });

  it("reclaims a stale lock (>60s old)", async () => {
    // Write a lock file with an old timestamp
    const lockPath = path.join(mockHome, ".synctax", "sync.lock");
    const staleInfo = {
      pid: 99999,
      timestamp: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago
      command: "stale",
    };
    await fs.writeFile(lockPath, JSON.stringify(staleInfo), "utf-8");

    // Should succeed by reclaiming the stale lock
    const lock = await acquireLock("reclaim");
    const content = JSON.parse(await fs.readFile(lockPath, "utf-8"));
    expect(content.command).toBe("reclaim");
    await lock.release();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/lock.test.ts`
Expected: FAIL — module `../src/lock.js` not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lock.ts
import fs from "fs/promises";
import path from "path";
import os from "os";

const STALE_THRESHOLD_MS = 60_000;

interface LockInfo {
  pid: number;
  timestamp: string;
  command: string;
}

function getLockPath(): string {
  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  return path.join(homeDir, ".synctax", "sync.lock");
}

async function isStale(lockPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(lockPath, "utf-8");
    const info: LockInfo = JSON.parse(content);
    const lockTime = new Date(info.timestamp).getTime();
    return Date.now() - lockTime > STALE_THRESHOLD_MS;
  } catch {
    return true;
  }
}

export async function acquireLock(
  command = "unknown",
): Promise<{ release: () => Promise<void> }> {
  const lockPath = getLockPath();
  const dir = path.dirname(lockPath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});

  const lockInfo: LockInfo = {
    pid: process.pid,
    timestamp: new Date().toISOString(),
    command,
  };

  const tryWrite = async () => {
    await fs.writeFile(lockPath, JSON.stringify(lockInfo), {
      flag: "wx",
      encoding: "utf-8",
    });
  };

  try {
    await tryWrite();
  } catch (err: any) {
    if (err.code === "EEXIST") {
      if (await isStale(lockPath)) {
        await fs.unlink(lockPath).catch(() => {});
        try {
          await tryWrite();
        } catch {
          throw new Error(
            "Another synctax process is running. If this is incorrect, delete ~/.synctax/sync.lock",
          );
        }
      } else {
        let holder = "unknown";
        try {
          const content = await fs.readFile(lockPath, "utf-8");
          const info: LockInfo = JSON.parse(content);
          holder = `PID ${info.pid} (${info.command})`;
        } catch { /* ignore */ }
        throw new Error(
          `Another synctax process is running (${holder}). Wait for it to finish or delete ~/.synctax/sync.lock`,
        );
      }
    } else {
      throw err;
    }
  }

  return {
    release: async () => {
      await fs.unlink(lockPath).catch(() => {});
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/lock.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lock.ts tests/lock.test.ts
git commit -m "feat(safety): add file-based exclusive lock for concurrent sync prevention

Uses fs.writeFile with {flag:'wx'} for atomic lock creation.
Detects stale locks older than 60s and reclaims them."
```

---

### Task 3: Migrate `ConfigManager.write()` to Atomic Writes + Validate-First

**Files:**
- Modify: `src/config.ts:37-41`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/config.test.ts`:

```typescript
it("rejects invalid config before writing to disk", async () => {
  const configManager = getConfigManager();
  // Write a valid config first
  await configManager.write({ version: 1, activeProfile: "default", clients: {}, profiles: { default: {} }, resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } } } as any);

  // Try to write something that will fail Zod validation
  // Pass a config with version as a string (should be number)
  await expect(
    configManager.write({ version: "bad" } as any)
  ).rejects.toThrow();

  // Original config should still be intact
  const config = await configManager.read();
  expect(config.version).toBe(1);
});

it("does not leave temp files after successful write", async () => {
  const configManager = getConfigManager();
  await configManager.write({ version: 1, activeProfile: "default", clients: {}, profiles: { default: {} }, resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } } } as any);

  const dir = path.join(mockHome, ".synctax");
  const files = await fs.readdir(dir);
  const tempFiles = files.filter(f => f.endsWith(".synctax-tmp"));
  expect(tempFiles).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `bunx vitest run tests/config.test.ts -t "rejects invalid config"`
Expected: May pass or fail depending on Zod defaults — run to see baseline.

- [ ] **Step 3: Update ConfigManager.write() to use atomicWriteFile**

Edit `src/config.ts`:

Replace the import section (line 1-5):
```typescript
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigSchema } from "./types.js";
import type { Config } from "./types.js";
import { atomicWriteFile } from "./fs-utils.js";
```

Replace the `write()` method (lines 37-41):
```typescript
  async write(config: Config): Promise<void> {
    const validated = ConfigSchema.parse(config); // validate FIRST
    await this.ensureConfigDir();
    await atomicWriteFile(this.configPath, JSON.stringify(validated, null, 2));
  }
```

- [ ] **Step 4: Run tests to verify**

Run: `bunx vitest run tests/config.test.ts`
Expected: All config tests PASS (including new ones)

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "fix(safety): validate config before write, use atomic file operations

ConfigManager.write() now validates via Zod BEFORE touching the filesystem,
and writes via atomicWriteFile to prevent corruption on crash."
```

---

### Task 4: Add Snapshot Failure Warnings in `sync.ts`

**Files:**
- Modify: `src/commands/sync.ts:120-124`

- [ ] **Step 1: Write the failing test**

Add to `tests/commands.test.ts` (or create `tests/sync-safety.test.ts`):

```typescript
it("warns when a client snapshot fails during sync", async () => {
  // Set up a mock adapter that throws on read()
  const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  // ... setup adapted to existing test patterns in commands.test.ts
  // Register a mock adapter whose read() throws
  const originalAdapters = { ...adapters };
  adapters["mock-broken"] = {
    id: "mock-broken",
    name: "Broken Client",
    detect: async () => true,
    read: async () => { throw new Error("disk on fire"); },
    write: async () => {},
    getMemoryFileName: () => "BROKEN.md",
    readMemory: async () => null,
    writeMemory: async () => {},
    getCapabilities: () => ({ mcps: true, agents: false, skills: false }),
  } as any;

  // Write config enabling the broken adapter
  const configManager = getConfigManager();
  await configManager.write({
    version: 1,
    activeProfile: "default",
    clients: { "mock-broken": { enabled: true } },
    profiles: { default: {} },
    resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } },
  } as any);

  await syncCommand({ dryRun: false });

  // Verify a warning about the snapshot failure was logged
  const output = warnSpy.mock.calls.flat().join("\n");
  expect(output).toContain("Snapshot failed");

  // Cleanup
  delete adapters["mock-broken"];
  Object.assign(adapters, originalAdapters);
  warnSpy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/commands.test.ts -t "warns when a client snapshot fails"`
Expected: FAIL — output does not contain "Snapshot failed" (empty catch block)

- [ ] **Step 3: Replace empty catch with warning**

Edit `src/commands/sync.ts` lines 120-124. Replace:
```typescript
      } catch {
        // Best-effort snapshot; rollback skips clients without a readable snapshot.
      }
```

With:
```typescript
      } catch (err: any) {
        ui.warn(`Snapshot failed for ${adapter.name}: ${err?.message || "unknown error"}. Rollback for this client will be unavailable.`);
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/commands.test.ts -t "warns when a client snapshot fails"`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/sync.ts tests/commands.test.ts
git commit -m "fix(safety): warn on snapshot failure instead of silent swallow

Empty catch blocks during pre-sync snapshot now log a warning
so users know which clients lack rollback protection."
```

---

### Task 5: Add `process.env` Fallback Warning in `env-vault.ts`

**Files:**
- Modify: `src/env-vault.ts:111-113`
- Modify: `tests/env-vault.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/env-vault.test.ts`:

```typescript
it("warns when resolving from process.env instead of profile vars", () => {
  const vault = new EnvVault();

  // Set a process.env variable
  process.env.TEST_FALLBACK_VAR = "from-process";

  const result = vault.resolveEnvValue("$TEST_FALLBACK_VAR", {});
  expect(result.resolved).toBe(true);
  expect(result.value).toBe("from-process");
  expect(result.warning).toContain("process.env");

  delete process.env.TEST_FALLBACK_VAR;
});

it("prefers profile vars over process.env", () => {
  const vault = new EnvVault();

  process.env.TEST_PREF_VAR = "from-process";

  const result = vault.resolveEnvValue("$TEST_PREF_VAR", { TEST_PREF_VAR: "from-profile" });
  expect(result.resolved).toBe(true);
  expect(result.value).toBe("from-profile");
  expect(result.warning).toBeUndefined();

  delete process.env.TEST_PREF_VAR;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/env-vault.test.ts -t "warns when resolving from process.env"`
Expected: FAIL — `result.warning` is undefined (no warning emitted currently)

- [ ] **Step 3: Add warning to resolveEnvValue**

Edit `src/env-vault.ts` lines 111-113. Replace:

```typescript
    const fromProcess = process.env[variable];
    if (fromProcess !== undefined) {
      return { value: fromProcess, resolved: true };
    }
```

With:

```typescript
    const fromProcess = process.env[variable];
    if (fromProcess !== undefined) {
      return {
        value: fromProcess,
        resolved: true,
        warning: `"${variable}" resolved from process.env (not profile .env). Use --strict-env to disable this fallback.`,
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/env-vault.test.ts`
Expected: All env-vault tests PASS (including 2 new ones)

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/env-vault.ts tests/env-vault.test.ts
git commit -m "fix(safety): warn when env var resolves from process.env fallback

Prevents silent cross-profile credential leakage by alerting
users when a variable comes from the shell environment instead
of the profile .env file."
```

---

### Task 6: Fix Init Source Selection — Always Ask

**Files:**
- Modify: `src/commands/init.ts:1-5, 91-100`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the init tests in `tests/commands.test.ts`:

```typescript
it("prompts user to select source when clients are detected", async () => {
  // Mock the select prompt
  const { select } = await import("@inquirer/prompts");
  vi.mocked(select).mockResolvedValueOnce("cursor");

  // Register mock adapters
  adapters["claude"] = { id: "claude", name: "Claude Code", detect: async () => true, read: async () => ({ mcps: {}, agents: {}, skills: {} }), write: async () => {}, getMemoryFileName: () => "CLAUDE.md", readMemory: async () => null, writeMemory: async () => {}, getCapabilities: () => ({ mcps: true, agents: true, skills: true }) } as any;
  adapters["cursor"] = { id: "cursor", name: "Cursor", detect: async () => true, read: async () => ({ mcps: {}, agents: {}, skills: {} }), write: async () => {}, getMemoryFileName: () => ".cursorrules", readMemory: async () => null, writeMemory: async () => {}, getCapabilities: () => ({ mcps: true, agents: true, skills: true }) } as any;

  await initCommand({ force: true, skipBanner: true, noPathPrompt: true });

  // Verify select was called
  expect(select).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining("source of truth"),
  }));

  // Verify the user's choice was saved
  const config = await getConfigManager().read();
  expect(config.source).toBe("cursor");

  // Cleanup
  delete adapters["claude"];
  delete adapters["cursor"];
});
```

Note: The exact test setup will depend on existing test patterns in `commands.test.ts`. Check how `@inquirer/prompts` is mocked there and follow the same pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/commands.test.ts -t "prompts user to select source"`
Expected: FAIL — init silently picks first client, never calls `select`

- [ ] **Step 3: Update init.ts**

Edit `src/commands/init.ts`. Add import at top:
```typescript
import { select } from "@inquirer/prompts";
```

Replace lines 91-100:
```typescript
  if (!newConfig.source) {
    const firstClient = Object.keys(newConfig.clients)[0];
    if (firstClient) {
      newConfig.source = firstClient;
      const firstAdapter = adapters[firstClient];
      if (firstAdapter) {
        ui.dim(`Setting ${firstAdapter.name} as the default source.`);
      }
    }
  }
```

With:
```typescript
  if (!newConfig.source) {
    const detected = Object.entries(newConfig.clients)
      .filter(([, c]) => c.enabled)
      .map(([id]) => ({ id, name: adapters[id]?.name || id }));

    if (detected.length === 1) {
      newConfig.source = detected[0]!.id;
      ui.dim(`Setting ${detected[0]!.name} as the default source (only client detected).`);
    } else if (detected.length > 1) {
      const isTTY = process.stdin.isTTY && !process.env.VITEST;
      if (isTTY) {
        const choice = await select({
          message: "Which client should be your source of truth?",
          choices: detected.map(d => ({ name: d.name, value: d.id })),
        });
        newConfig.source = choice;
      } else {
        newConfig.source = detected[0]!.id;
        ui.dim(`Setting ${detected[0]!.name} as default source (non-interactive).`);
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/commands.test.ts -t "prompts user to select source"`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/init.ts tests/commands.test.ts
git commit -m "fix(ux): always ask user to select source client during init

Replaces the silent first-detected-client default with an
interactive prompt when multiple clients are detected."
```

---

### Task 7: Remove Hardcoded "claude" Fallback in Memory-Sync

**Files:**
- Modify: `src/commands/sync.ts:214-221`
- Modify: `tests/sanity_checks.test.ts` (or `tests/commands.test.ts`)

- [ ] **Step 1: Write the failing test**

```typescript
it("errors when memory-sync has no valid source instead of defaulting to claude", async () => {
  const configManager = getConfigManager();
  await configManager.write({
    version: 1,
    source: "nonexistent-client",
    activeProfile: "default",
    clients: {},
    profiles: { default: {} },
    resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } },
  } as any);

  const errorSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  await memorySyncCommand({});

  expect(process.exitCode).toBe(1);
  const output = errorSpy.mock.calls.flat().join("\n");
  expect(output).toContain("not found");
  expect(output).not.toContain("Defaulting to");

  errorSpy.mockRestore();
  process.exitCode = undefined as any;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run -t "errors when memory-sync has no valid source"`
Expected: FAIL — currently defaults to "claude" instead of erroring

- [ ] **Step 3: Replace hardcoded fallback**

Edit `src/commands/sync.ts` lines 214-221. Replace:

```typescript
  if (!sourceAdapter) {
    sourceAdapter = adapters["claude"];
    if (!sourceAdapter) {
      ui.error("No valid source of truth adapter found.");
      process.exitCode = 1;
      return;
    }
    console.log(ui.format.warn(`No valid source of truth found. Defaulting to ${sourceAdapter.name}.`, { prefix: "" }));
  }
```

With:

```typescript
  if (!sourceAdapter) {
    ui.error(`Source client "${sourceId || "(none)"}" not found. Run "synctax init" to set a valid source.`);
    process.exitCode = 1;
    return;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run -t "errors when memory-sync has no valid source"`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS (check that existing memory-sync tests still pass — they may need updating if they relied on the claude fallback)

- [ ] **Step 6: Commit**

```bash
git add src/commands/sync.ts tests/sanity_checks.test.ts
git commit -m "fix(ux): remove hardcoded claude fallback in memory-sync

memory-sync now errors clearly when the configured source client
is invalid, instead of silently falling back to Claude Code."
```

---

### Task 8: Fix `profilePublishCommand` Data Leak

**Files:**
- Modify: `src/commands/profile.ts:265-278`
- Modify: `tests/profiles.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/profiles.test.ts`:

```typescript
it("profilePublishCommand exports only resources matching the profile include list", async () => {
  const configManager = getConfigManager();
  await configManager.write({
    version: 1,
    activeProfile: "default",
    clients: {},
    profiles: {
      default: {},
      "team-a": { include: ["shared-mcp"] },
    },
    resources: {
      mcps: {
        "shared-mcp": { command: "npx", args: ["-y", "shared"] },
        "personal-mcp": { command: "npx", args: ["-y", "personal"] },
      },
      agents: {
        "shared-agent": { name: "Shared", prompt: "shared" },
        "personal-agent": { name: "Personal", prompt: "personal" },
      },
      skills: {},
      permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] },
    },
  } as any);

  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const result = await profilePublishCommand("team-a", {});
  consoleSpy.mockRestore();

  // Should only contain "shared-mcp", NOT "personal-mcp"
  expect(result.resources.mcps).toHaveProperty("shared-mcp");
  expect(result.resources.mcps).not.toHaveProperty("personal-mcp");

  // Should only contain "shared-agent" (it's not in include list, so it should be excluded)
  // Actually: include list applies to mcps, agents, and skills uniformly
  expect(result.resources.agents).not.toHaveProperty("personal-agent");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/profiles.test.ts -t "profilePublishCommand exports only resources"`
Expected: FAIL — `personal-mcp` is present in the export (current bug)

- [ ] **Step 3: Fix profilePublishCommand to filter resources**

Edit `src/commands/profile.ts` lines 265-278. Replace:

```typescript
  // Strip credentials and generate export
  const exportPayload = {
    name,
    profile: config.profiles[name],
    resources: {
      mcps: config.resources.mcps,
      agents: config.resources.agents,
      skills: config.resources.skills,
      permissions: config.resources.permissions,
      models: config.resources.models,
      prompts: config.resources.prompts,
      // Credentials explicitly excluded
    }
  };
```

With:

```typescript
  // Filter resources by profile include/exclude before export
  let resolvedProfile: any;
  try {
    resolvedProfile = resolveProfile(config.profiles, name);
  } catch (e: any) {
    ui.error(`Profile resolution failed: ${e.message}`);
    process.exitCode = 1;
    return null;
  }
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
      // Credentials explicitly excluded
    }
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/profiles.test.ts -t "profilePublishCommand exports only resources"`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/profile.ts tests/profiles.test.ts
git commit -m "fix(security): filter resources by profile before publishing

profilePublishCommand now applies applyProfileFilter() before
building the export payload, preventing data leakage of resources
from other profiles."
```

---

### Task 9: Add Resource Collision Warnings to `profilePullCommand`

**Files:**
- Modify: `src/commands/profile.ts:222-235`
- Modify: `tests/profiles.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/profiles.test.ts`:

```typescript
it("profilePullCommand warns about resource name collisions", async () => {
  const configManager = getConfigManager();
  await configManager.write({
    version: 1,
    activeProfile: "default",
    clients: {},
    profiles: { default: {} },
    resources: {
      mcps: { "existing-mcp": { command: "npx", args: [] } },
      agents: {},
      skills: {},
      permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] },
    },
  } as any);

  // Mock fetch to return a payload with a colliding MCP name
  const mockPayload = {
    name: "remote-profile",
    profile: {},
    resources: {
      mcps: { "existing-mcp": { command: "different", args: [] } },
    },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockPayload,
  }));

  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  await profilePullCommand("https://example.com/profile.json", { name: "remote-profile" });
  consoleSpy.mockRestore();

  const output = consoleSpy.mock.calls.flat().join("\n");
  expect(output).toContain("collision");

  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/profiles.test.ts -t "warns about resource name collisions"`
Expected: FAIL — no collision warning emitted

- [ ] **Step 3: Add collision detection before merge**

Edit `src/commands/profile.ts`. Before the merge block (line 228), add:

```typescript
      // Detect resource name collisions
      const collisionDomains = ["mcps", "agents", "skills"] as const;
      const allCollisions: string[] = [];
      for (const domain of collisionDomains) {
        const incomingKeys = Object.keys((payload.resources as any)[domain] || {});
        const existingKeys = Object.keys((config.resources as any)[domain] || {});
        const collisions = incomingKeys.filter(k => existingKeys.includes(k));
        if (collisions.length > 0) {
          allCollisions.push(...collisions.map(k => `${domain}/${k}`));
        }
      }
      if (allCollisions.length > 0) {
        ui.warn(`Resource name collisions detected: ${allCollisions.join(", ")}`);
        ui.warn("Incoming definitions will overwrite existing ones.");
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/profiles.test.ts -t "warns about resource name collisions"`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/profile.ts tests/profiles.test.ts
git commit -m "fix(ux): warn about resource name collisions during profile pull

When pulling a remote profile, warns if incoming resources
share names with existing ones (which will be overwritten)."
```

---

### Task 10: Add TUI Viewport Fallback Message

**Files:**
- Modify: `src/tui/entry.ts:20-22`

- [ ] **Step 1: Write the failing test**

Add to `tests/tui/entry.test.ts`:

```typescript
it("logs a message when viewport is too small for TUI", async () => {
  // Mock stdout to have small viewport
  const originalColumns = process.stdout.columns;
  const originalRows = process.stdout.rows;
  Object.defineProperty(process.stdout, "columns", { value: 60, configurable: true });
  Object.defineProperty(process.stdout, "rows", { value: 20, configurable: true });

  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  // ... call startNoArgExperience (mocking startInteractiveMode)

  const output = consoleSpy.mock.calls.flat().join("\n");
  expect(output).toContain("Terminal too small");

  // Restore
  Object.defineProperty(process.stdout, "columns", { value: originalColumns, configurable: true });
  Object.defineProperty(process.stdout, "rows", { value: originalRows, configurable: true });
  consoleSpy.mockRestore();
});
```

Note: The exact test setup depends on how `tests/tui/entry.test.ts` currently mocks things. Follow the existing pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/tui/entry.test.ts -t "logs a message when viewport"`
Expected: FAIL — no message logged currently

- [ ] **Step 3: Add viewport message**

Edit `src/tui/entry.ts`. Add import at top:
```typescript
import * as ui from "../ui/index.js";
```

Replace lines 20-22:
```typescript
  await startInteractiveMode(themeOverride);
```

With:
```typescript
  if (hasTty && !hasViewport) {
    const cols = process.stdout.columns || 0;
    const rows = process.stdout.rows || 0;
    ui.dim(`Terminal too small for TUI (need ${MIN_FULLSCREEN_WIDTH}x${MIN_FULLSCREEN_HEIGHT}, got ${cols}x${rows}). Using interactive mode.`);
  }
  await startInteractiveMode(themeOverride);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/tui/entry.test.ts`
Expected: All entry tests PASS

- [ ] **Step 5: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/tui/entry.ts tests/tui/entry.test.ts
git commit -m "fix(ux): log message when terminal is too small for TUI

Users now see why they get interactive mode instead of the
fullscreen TUI dashboard."
```

---

### Task 11: Add `--yes` Flag to Sync Command in CLI

**Files:**
- Modify: `bin/synctax.ts:71-77`

This wires the `--yes` flag that will be used by the client-first sync (Phase C). For now, it's a no-op that gets plumbed through — the diff+confirm logic will consume it in the next plan.

- [ ] **Step 1: Add the flag**

Edit `bin/synctax.ts` lines 71-77. Replace:

```typescript
program
  .command("sync")
  .description("Push all resources from master to all enabled clients")
  .option("--dry-run", "Preview all changes without writing any files")
  .option("-i, --interactive", "Interactively select resources to sync")
  .action((options) => {
    void syncCommand(options);
  });
```

With:

```typescript
program
  .command("sync")
  .description("Push all resources from master to all enabled clients")
  .option("--dry-run", "Preview all changes without writing any files")
  .option("-y, --yes", "Skip confirmation prompt (auto-approve)")
  .option("--strict-env", "Refuse to sync if env vars fall back to process.env")
  .option("-i, --interactive", "Interactively select resources to sync")
  .action((options) => {
    void syncCommand(options);
  });
```

- [ ] **Step 2: Verify flag is recognized**

Run: `bun ./bin/synctax.ts sync --help`
Expected: Output includes `--yes` and `--strict-env` in the options list

- [ ] **Step 3: Run full suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add bin/synctax.ts
git commit -m "feat(cli): add --yes and --strict-env flags to sync command

--yes will skip the diff+confirm prompt (used by watch daemon).
--strict-env will refuse process.env fallback for env resolution."
```

---

### Task 12: Final Validation — Full Suite + Type Check

- [ ] **Step 1: Run full test suite**

Run: `bunx vitest run`
Expected: All tests PASS (443+ tests across 48+ suites)

- [ ] **Step 2: Run type check**

Run: `bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `bun run lint`
Expected: No new errors (existing warnings are acceptable)

- [ ] **Step 4: Manual smoke test**

Run: `bun ./bin/synctax.ts --help`
Expected: Shows all commands including sync with `--yes` and `--strict-env`

Run: `bun ./bin/synctax.ts sync --help`
Expected: Shows `--yes`, `--strict-env`, `--dry-run`, `--interactive` options

- [ ] **Step 5: Commit if any final adjustments were needed**

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Atomic write utilities | `src/fs-utils.ts` | 5 new |
| 2 | File lock | `src/lock.ts` | 4 new |
| 3 | ConfigManager atomic + validate-first | `src/config.ts` | 2 new |
| 4 | Snapshot failure warnings | `src/commands/sync.ts` | 1 new |
| 5 | process.env fallback warning | `src/env-vault.ts` | 2 new |
| 6 | Init always-ask source | `src/commands/init.ts` | 1 new |
| 7 | Remove claude fallback | `src/commands/sync.ts` | 1 new |
| 8 | Profile publish data leak fix | `src/commands/profile.ts` | 1 new |
| 9 | Collision warnings on pull | `src/commands/profile.ts` | 1 new |
| 10 | TUI viewport message | `src/tui/entry.ts` | 1 new |
| 11 | CLI flags (--yes, --strict-env) | `bin/synctax.ts` | 0 (smoke) |
| 12 | Final validation | — | full suite |

**Total new tests:** ~19
**New files:** 4 (2 source + 2 test)
**Modified files:** 8
