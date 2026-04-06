import * as ui from "../ui/index.js";
import { applyProfileFilter, getConfigManager, mergePermissions, resolveProfile } from "./_shared.js";
import { syncCommand } from "./sync.js";
import { getVersion } from "../version.js";
import { EnvVault } from "../env-vault.js";
import { assertSafeResourceMapKeys } from "../resource-name.js";

function toSortedKeys(record: Record<string, unknown> | undefined): string[] {
  return Object.keys(record || {}).sort((a, b) => a.localeCompare(b));
}

function summarizeProfile(profile: { include?: string[], exclude?: string[] }) {
  const includeCount = profile.include?.length || 0;
  const excludeCount = profile.exclude?.length || 0;
  return `${includeCount} include${includeCount === 1 ? "" : "s"}, ${excludeCount} exclude${excludeCount === 1 ? "" : "s"}`;
}

export async function profileListCommand(options?: { json?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();
  const profileNames = Object.keys(config.profiles || {}).sort((a, b) => a.localeCompare(b));

  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          activeProfile: config.activeProfile,
          count: profileNames.length,
          profiles: profileNames.map((name) => ({
            name,
            active: name === config.activeProfile,
            include: config.profiles[name]?.include || [],
            exclude: config.profiles[name]?.exclude || [],
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Profiles:");

  if (profileNames.length === 0) {
    ui.warn("No profiles found.");
    console.log(ui.format.summary(timer.elapsed(), "0 profiles listed"));
    return;
  }

  for (const name of profileNames) {
    const profile = config.profiles[name] || {};
    const marker = name === config.activeProfile ? " (active)" : "";
    const extendsInfo = profile.extends ? `, extends ${profile.extends}` : "";
    console.log(`- ${name}${marker} ${ui.symbols.bullet} ${summarizeProfile(profile)}${extendsInfo}`);
  }

  console.log(ui.format.summary(timer.elapsed(), `${profileNames.length} profile${profileNames.length === 1 ? "" : "s"} listed`));
}

export async function profileDiffCommand(name: string, options?: { json?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  if (!config.profiles[name]) {
    ui.error(`Profile ${name} does not exist.`);
    process.exitCode = 1;
    return;
  }

  let resolvedProfile: any;
  let filteredResources: any;
  try {
    resolvedProfile = resolveProfile(config.profiles, name);
    filteredResources = await applyProfileFilter(config.resources, resolvedProfile);
  } catch (error: any) {
    ui.error(`Profile resolution failed: ${error?.message || String(error)}`);
    process.exitCode = 1;
    return;
  }

  const domains = [
    { key: "mcps", label: "MCPs" },
    { key: "agents", label: "Agents" },
    { key: "skills", label: "Skills" },
  ] as const;

  const diff = domains.map(({ key, label }) => {
    const all = toSortedKeys((config.resources as any)[key]);
    const included = toSortedKeys((filteredResources as any)[key]);
    const includedSet = new Set(included);
    const excluded = all.filter((resourceName) => !includedSet.has(resourceName));
    return { key, label, included, excluded };
  });

  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          profile: name,
          resolvedProfile,
          domains: diff,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header(`Profile diff: ${name}`);
  ui.dim(`Resolved include/exclude effect from profile \"${name}\".`);

  for (const domain of diff) {
    console.log(`\n${domain.label}`);
    console.log(`  Included (${domain.included.length}): ${domain.included.length ? domain.included.join(", ") : "(none)"}`);
    console.log(`  Excluded (${domain.excluded.length}): ${domain.excluded.length ? domain.excluded.join(", ") : "(none)"}`);
  }

  console.log(ui.format.summary(timer.elapsed(), `profile \"${name}\" diff generated`));
}

export async function profileCreateCommand(name: string, options: { include?: string, exclude?: string }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header(`Creating profile: ${name}...`);

  if (config.profiles[name]) {
    console.log(ui.format.warn(`Profile ${name} already exists.`, { prefix: "" }));
    return;
  }

  config.profiles[name] = {
    include: options.include ? options.include.split(",").map(s => s.trim()) : undefined,
    exclude: options.exclude ? options.exclude.split(",").map(s => s.trim()) : undefined
  };

  await configManager.write(config);
  const ensured = await new EnvVault().ensureProfileEnv(name);
  if (ensured.created) {
    ui.warn(`Created profile env file: ${ensured.path}`);
  }
  ui.success(`Profile ${name} created successfully.`);

  console.log(ui.format.summary(timer.elapsed(), `profile "${name}" created`));
}

export async function profileUseCommand(name: string, options: { dryRun?: boolean, noSync?: boolean, yes?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header(`Switching to profile: ${name}...`);

  if (!config.profiles[name]) {
    ui.error(`Profile ${name} does not exist.`);
    process.exitCode = 1;
    return;
  }

  if (options.dryRun) {
    ui.dryRun(`Would switch active profile to ${name}`);
    return;
  }

  config.activeProfile = name;
  await configManager.write(config);
  const ensured = await new EnvVault().ensureProfileEnv(name);
  if (ensured.created) {
    ui.warn(`Created profile env file: ${ensured.path}`);
  }
  ui.success(`Active profile is now ${name}.`);

  console.log(ui.format.summary(timer.elapsed(), `switched to profile "${name}"`));

  if (!options.noSync) {
    await syncCommand({ yes: options.yes });
  }
}

export async function profilePullCommand(url: string, options?: any) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  // Read config for brand header before doing fetch
  let activeProfile = "default";
  try {
    const existingConfig = await configManager.read();
    activeProfile = existingConfig.activeProfile || "default";
  } catch (e) {
    // Config may not exist yet
  }

  console.log(ui.format.brandHeader(getVersion(), activeProfile));
  ui.header(`Pulling profile from ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload: any = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid profile payload: expected object");
    }
    if (!payload.profile || typeof payload.profile !== "object" || Array.isArray(payload.profile)) {
      throw new Error("Invalid profile payload: missing profile object");
    }
    const name = options?.name || payload.name || "downloaded-profile";

    const config = await configManager.read();

    config.profiles[name] = payload.profile;

    // Merge resources
    if (payload.resources) {
      assertSafeResourceMapKeys(payload.resources.mcps as Record<string, unknown> | undefined, "MCP");
      assertSafeResourceMapKeys(payload.resources.agents as Record<string, unknown> | undefined, "agent");
      assertSafeResourceMapKeys(payload.resources.skills as Record<string, unknown> | undefined, "skill");

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

      if (payload.resources.mcps) config.resources.mcps = { ...config.resources.mcps, ...payload.resources.mcps };
      if (payload.resources.agents) config.resources.agents = { ...config.resources.agents, ...payload.resources.agents };
      if (payload.resources.skills) config.resources.skills = { ...config.resources.skills, ...payload.resources.skills };
      if (payload.resources.permissions) {
        config.resources.permissions = mergePermissions(config.resources.permissions, payload.resources.permissions);
      }
      if (payload.resources.models) config.resources.models = { ...config.resources.models, ...payload.resources.models };
      if (payload.resources.prompts) config.resources.prompts = { ...config.resources.prompts, ...payload.resources.prompts };
    }

    await configManager.write(config);
    ui.success(`Imported profile ${name}`);

    console.log(ui.format.summary(timer.elapsed(), `profile "${name}" imported from URL`));

    if (options?.apply) {
      await profileUseCommand(name, {});
    }
  } catch (e: any) {
    ui.error(`Failed to pull profile: ${e.message}`);
    process.exitCode = 1;
  }
}

export async function profilePublishCommand(name: string, options?: any): Promise<any> {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));

  if (!config.profiles[name]) {
    ui.error(`Profile ${name} not found.`);
    process.exitCode = 1;
    return null;
  }

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

  const jsonStr = JSON.stringify(exportPayload, null, 2);

  if (options?.output) {
    const fs = await import("fs/promises");
    await fs.writeFile(options.output, jsonStr, "utf-8");
    ui.success(`Profile ${name} exported to ${options.output}`);
  } else {
    ui.header(`Profile Export JSON:`);
    console.log(jsonStr);
  }

  console.log(ui.format.summary(timer.elapsed(), `profile "${name}" published`));

  return exportPayload;
}
