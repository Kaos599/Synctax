import fs from "fs/promises";
import os from "os";
import path from "path";

type ProfileVars = Record<string, string>;

export class EnvVault {
  private get envDir(): string {
    const homeDir = process.env.SYNCTAX_HOME || os.homedir();
    return path.join(homeDir, ".synctax", "envs");
  }

  private safeProfileFileStem(profileName: string): string {
    const trimmed = profileName.trim();
    if (!trimmed) {
      throw new Error("Profile name cannot be empty.");
    }
    return encodeURIComponent(trimmed).replace(/\./g, "%2E");
  }

  private envFilePath(profileName: string): string {
    return path.join(this.envDir, `${this.safeProfileFileStem(profileName)}.env`);
  }

  async ensureProfileEnv(profileName: string): Promise<{ path: string; created: boolean }> {
    const envPath = this.envFilePath(profileName);
    await fs.mkdir(this.envDir, { recursive: true });

    try {
      await fs.access(envPath);
      await fs.chmod(envPath, 0o600).catch(() => {});
      return { path: envPath, created: false };
    } catch {
      await fs.writeFile(envPath, "", { encoding: "utf-8", mode: 0o600 });
      await fs.chmod(envPath, 0o600).catch(() => {});
      return { path: envPath, created: true };
    }
  }

  async loadProfileEnv(
    profileName: string,
    options?: { ensure?: boolean },
  ): Promise<{ path: string; vars: ProfileVars; warnings: string[]; created: boolean }> {
    const shouldEnsure = options?.ensure !== false;
    const envPath = this.envFilePath(profileName);

    let created = false;
    let targetPath = envPath;
    if (shouldEnsure) {
      const ensured = await this.ensureProfileEnv(profileName);
      created = ensured.created;
      targetPath = ensured.path;
    } else {
      try {
        await fs.access(envPath);
      } catch {
        return {
          path: envPath,
          vars: {},
          warnings: [`Missing profile env file: ${envPath}`],
          created: false,
        };
      }
    }

    const content = await fs.readFile(targetPath, "utf-8");

    const vars: ProfileVars = {};
    const warnings: string[] = [];

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) {
        warnings.push(`Invalid env line (missing '='): ${rawLine}`);
        continue;
      }

      const key = line.slice(0, eqIndex).trim();
      if (!key) {
        warnings.push(`Invalid env line (empty key): ${rawLine}`);
        continue;
      }

      const value = line.slice(eqIndex + 1).trim();
      vars[key] = value;
    }

    return { path: targetPath, vars, warnings, created };
  }

  resolveEnvValue(
    value: string,
    profileVars: ProfileVars,
  ): { value: string; resolved: boolean; warning?: string } {
    if (!value.startsWith("$")) {
      return { value, resolved: true };
    }

    const variable = value.slice(1);
    if (!variable) {
      return { value, resolved: false, warning: "Unresolved env placeholder: $" };
    }

    if (Object.prototype.hasOwnProperty.call(profileVars, variable)) {
      return { value: profileVars[variable] as string, resolved: true };
    }

    const fromProcess = process.env[variable];
    if (fromProcess !== undefined) {
      return { value: fromProcess, resolved: true };
    }

    return {
      value,
      resolved: false,
      warning: `Unresolved env placeholder: ${value} (${variable})`,
    };
  }

  resolveMcpEnv(
    envMap: Record<string, string> | undefined,
    profileVars: ProfileVars,
  ): { env: Record<string, string>; warnings: string[] } {
    if (!envMap) {
      return { env: {}, warnings: [] };
    }

    const env: Record<string, string> = {};
    const warnings: string[] = [];

    for (const [key, value] of Object.entries(envMap)) {
      const resolved = this.resolveEnvValue(value, profileVars);
      env[key] = resolved.value;
      if (resolved.warning) warnings.push(resolved.warning);
    }

    return { env, warnings };
  }
}
