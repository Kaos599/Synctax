import * as ui from "../ui/index.js";
import { Config } from "../types.js";
import { printBanner } from "../banner.js";
import { maybePromptAndInstallPath } from "../install-path.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";

export async function initCommand(options: {
  detect?: boolean;
  source?: string;
  force?: boolean;
  theme?: string;
  yes?: boolean;
  noPathPrompt?: boolean;
  skipBanner?: boolean;
}) {
  if (!options.skipBanner) {
    printBanner(options.theme || "rebel");
  }
  const configManager = getConfigManager();
  ui.header("Initializing synctax...");

  let currentConfig: Config | null = null;
  try {
    currentConfig = await configManager.read();
  } catch (e) {
    // Config may not exist or is invalid
  }

  if (currentConfig && Object.keys(currentConfig.clients).length > 0 && !options.force) {
    console.log(ui.format.warn("Configuration already exists. Use --force to overwrite.", { prefix: "" }));
    return;
  }

  const newConfig: Config = {
    version: 1,
    source: options.source,
    theme: options.theme || "rebel",
    clients: {},
    resources: { mcps: {}, agents: {}, skills: {} },
  };

  if (options.detect !== false) {
    ui.dim("Detecting clients...");
    ui.dim("(Looking for client config files on disk, not running processes.)");
    for (const [id, adapter] of Object.entries(adapters)) {
      const detected = await adapter.detect();
      if (detected) {
        ui.success(`Found ${adapter.name}`);
        newConfig.clients[id] = { enabled: true };
      }
    }
  }

  if (!newConfig.source) {
    const firstClient = Object.keys(newConfig.clients)[0];
    if (firstClient) {
      newConfig.source = firstClient;
      ui.dim(`Setting ${adapters[firstClient].name} as the default source.`);
    }
  }

  await configManager.write(newConfig);
  ui.success("Initialization complete!");

  await maybePromptAndInstallPath({
    assumeYes: options.yes,
    noPathPrompt: options.noPathPrompt,
  });
}
