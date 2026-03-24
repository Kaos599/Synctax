import * as ui from "../ui/index.js";
import { getConfigManager } from "./_shared.js";
import { syncCommand } from "./sync.js";

export async function profileCreateCommand(name: string, options: { include?: string, exclude?: string }) {
  const configManager = getConfigManager();
  ui.header(`Creating profile: ${name}...`);

  const config = await configManager.read();

  if (config.profiles[name]) {
    console.log(ui.format.warn(`Profile ${name} already exists.`, { prefix: "" }));
    return;
  }

  config.profiles[name] = {
    include: options.include ? options.include.split(",").map(s => s.trim()) : undefined,
    exclude: options.exclude ? options.exclude.split(",").map(s => s.trim()) : undefined
  };

  await configManager.write(config);
  ui.success(`Profile ${name} created successfully.`);
}

export async function profileUseCommand(name: string, options: { dryRun?: boolean, noSync?: boolean }) {
  const configManager = getConfigManager();
  ui.header(`Switching to profile: ${name}...`);

  const config = await configManager.read();

  if (!config.profiles[name]) {
    ui.error(`Profile ${name} does not exist.`);
    return;
  }

  if (options.dryRun) {
    ui.dryRun(`Would switch active profile to ${name}`);
    return;
  }

  config.activeProfile = name;
  await configManager.write(config);
  ui.success(`Active profile is now ${name}.`);

  if (!options.noSync) {
    await syncCommand({});
  }
}

export async function profilePullCommand(url: string, options?: any) {
  const configManager = getConfigManager();
  ui.header(`Pulling profile from ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const name = options?.name || payload.name || "downloaded-profile";

    const config = await configManager.read();

    config.profiles[name] = payload.profile;

    // Merge resources
    if (payload.resources) {
      if (payload.resources.mcps) config.resources.mcps = { ...config.resources.mcps, ...payload.resources.mcps };
      if (payload.resources.agents) config.resources.agents = { ...config.resources.agents, ...payload.resources.agents };
      if (payload.resources.skills) config.resources.skills = { ...config.resources.skills, ...payload.resources.skills };
    }

    await configManager.write(config);
    ui.success(`Imported profile ${name}`);

    if (options?.apply) {
      await profileUseCommand(name, {});
    }
  } catch (e: any) {
    ui.error(`Failed to pull profile: ${e.message}`);
  }
}

export async function profilePublishCommand(name: string, options?: any): Promise<any> {
  const configManager = getConfigManager();
  const config = await configManager.read();

  if (!config.profiles[name]) {
    ui.error(`Profile ${name} not found.`);
    return null;
  }

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

  const jsonStr = JSON.stringify(exportPayload, null, 2);

  if (options?.output) {
    const fs = await import("fs/promises");
    await fs.writeFile(options.output, jsonStr, "utf-8");
    ui.success(`Profile ${name} exported to ${options.output}`);
  } else {
    ui.header(`Profile Export JSON:`);
    console.log(jsonStr);
  }

  return exportPayload;
}
