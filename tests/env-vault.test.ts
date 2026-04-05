import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { EnvVault } from "../src/env-vault.js";

describe("EnvVault", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-env-vault-test-"));
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    delete process.env.SYNCTAX_ENV_FALLBACK;
  });

  it("ensureProfileEnv creates a profile env file", async () => {
    const vault = new EnvVault();

    const first = await vault.ensureProfileEnv("work");
    const second = await vault.ensureProfileEnv("work");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.path).toBe(path.join(mockHome, ".synctax", "envs", "work.env"));
    await expect(fs.readFile(first.path, "utf-8")).resolves.toBe("");
  });

  it("loadProfileEnv parses dotenv style key-value pairs", async () => {
    const vault = new EnvVault();
    const envPath = path.join(mockHome, ".synctax", "envs", "default.env");
    await fs.mkdir(path.dirname(envPath), { recursive: true });
    await fs.writeFile(
      envPath,
      [
        "# profile env",
        "API_KEY=abc123",
        " SPACED = value with spaces ",
        "NO_EQUALS",
        "EMPTY=",
      ].join("\n"),
      "utf-8",
    );

    const loaded = await vault.loadProfileEnv("default");

    expect(loaded.vars).toEqual({
      API_KEY: "abc123",
      SPACED: "value with spaces",
      EMPTY: "",
    });
    expect(loaded.warnings.some((w: string) => w.includes("NO_EQUALS"))).toBe(true);
  });

  it("resolveEnvValue prefers profile vars then process env", () => {
    process.env.SYNCTAX_ENV_FALLBACK = "from-process";
    const vault = new EnvVault();

    const fromProfile = vault.resolveEnvValue("$TOKEN", { TOKEN: "from-profile" });
    const fromProcess = vault.resolveEnvValue("$SYNCTAX_ENV_FALLBACK", {});
    const unresolved = vault.resolveEnvValue("$MISSING_VALUE", {});
    const literal = vault.resolveEnvValue("plain-text", {});

    expect(fromProfile.value).toBe("from-profile");
    expect(fromProfile.resolved).toBe(true);
    expect(fromProcess.value).toBe("from-process");
    expect(fromProcess.resolved).toBe(true);
    expect(unresolved.value).toBe("$MISSING_VALUE");
    expect(unresolved.resolved).toBe(false);
    expect(unresolved.warning).toContain("MISSING_VALUE");
    expect(literal.value).toBe("plain-text");
    expect(literal.resolved).toBe(true);
  });

  it("resolveMcpEnv resolves placeholders and keeps unresolved values", () => {
    process.env.SYNCTAX_ENV_FALLBACK = "fallback";
    const vault = new EnvVault();

    const result = vault.resolveMcpEnv(
      {
        API_KEY: "$API_KEY",
        TOKEN: "$SYNCTAX_ENV_FALLBACK",
        MISSING: "$DOES_NOT_EXIST",
        LITERAL: "ok",
      },
      { API_KEY: "secret" },
    );

    expect(result.env).toEqual({
      API_KEY: "secret",
      TOKEN: "fallback",
      MISSING: "$DOES_NOT_EXIST",
      LITERAL: "ok",
    });
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.some((w: string) => w.includes("DOES_NOT_EXIST"))).toBe(true);
    expect(result.warnings.some((w: string) => w.includes("process.env"))).toBe(true);
  });

  it("warns when resolving from process.env instead of profile vars", () => {
    const vault = new EnvVault();
    process.env.SYNCTAX_ENV_FALLBACK = "from-process";

    const result = vault.resolveEnvValue("$SYNCTAX_ENV_FALLBACK", {});
    expect(result.resolved).toBe(true);
    expect(result.value).toBe("from-process");
    expect(result.warning).toContain("process.env");
  });

  it("prefers profile vars over process.env without warning", () => {
    const vault = new EnvVault();
    process.env.SYNCTAX_ENV_FALLBACK = "from-process";

    const result = vault.resolveEnvValue("$SYNCTAX_ENV_FALLBACK", { SYNCTAX_ENV_FALLBACK: "from-profile" });
    expect(result.resolved).toBe(true);
    expect(result.value).toBe("from-profile");
    expect(result.warning).toBeUndefined();
  });

  it("sanitizes profile names to prevent path traversal", async () => {
    const vault = new EnvVault();

    const ensured = await vault.ensureProfileEnv("../../evil");
    const relative = path.relative(path.join(mockHome, ".synctax", "envs"), ensured.path);

    expect(ensured.path.includes("..")).toBe(false);
    expect(relative.startsWith("..")).toBe(false);
    expect(path.dirname(relative)).toBe(".");
    expect(path.basename(ensured.path).endsWith(".env")).toBe(true);
    await expect(fs.readFile(ensured.path, "utf-8")).resolves.toBe("");
  });

  it("loadProfileEnv can read without creating files", async () => {
    const vault = new EnvVault();

    const loaded = await vault.loadProfileEnv("missing", { ensure: false });

    expect(loaded.created).toBe(false);
    expect(loaded.vars).toEqual({});
    expect(loaded.warnings.some((w: string) => w.includes("Missing profile env file"))).toBe(true);
    await expect(fs.access(path.join(mockHome, ".synctax", "envs", "missing.env"))).rejects.toBeDefined();
  });
});
