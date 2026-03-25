import * as ui from "../ui/index.js";
import type { Config } from "../types.js";
import { printBanner } from "../banner.js";
import { maybePromptAndInstallPath } from "../install-path.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";

export async function initCommand(options: {
  detect?: boolean;
  source?: string;
  force?: boolean;
  theme?: string;
  yes?: boolean;
  noPathPrompt?: boolean;
  skipBanner?: boolean;
}) {
  const timer = ui.startTimer();

  if (!options.skipBanner) {
    printBanner(options.theme || "rebel");
  }
  const configManager = getConfigManager();

  // Try reading existing config for brand header profile name
  let existingProfile = "default";
  let currentConfig: Config | null = null;
  try {
    currentConfig = await configManager.read();
    if (currentConfig?.activeProfile) {
      existingProfile = currentConfig.activeProfile;
    }
  } catch (e) {
    // Config may not exist or is invalid
  }

  console.log(ui.format.brandHeader(getVersion(), existingProfile));
  ui.header("Initializing synctax...");

  if (currentConfig && Object.keys(currentConfig.clients).length > 0 && !options.force) {
    console.log(ui.format.warn("Configuration already exists. Use --force to overwrite.", { prefix: "" }));
    return;
  }

  const newConfig: Config = {
    version: 1,
    source: options.source,
    theme: options.theme || "rebel",
    activeProfile: "default",
    clients: {},
    profiles: { default: {} },
    resources: {
      mcps: {},
      agents: {},
      skills: {},
      permissions: {
        allowedPaths: [],
        deniedPaths: [],
        allowedCommands: [],
        deniedCommands: [],
        networkAllow: false,
        allow: [],
        deny: [],
        ask: [],
        allowedUrls: [],
        deniedUrls: [],
        trustedFolders: [],
      },
    },
  };

  if (options.detect !== false) {
    ui.dim("Detecting clients...");
    ui.dim("(Looking for client config files on disk, not running processes.)");
    const spin = ui.spinner("Scanning for installed clients...");
    for (const [id, adapter] of Object.entries(adapters)) {
      const detected = await adapter.detect();
      if (detected) {
        spin.text(`Found ${adapter.name}`);
        newConfig.clients[id] = { enabled: true };
      }
    }
    const clientCount = Object.keys(newConfig.clients).length;
    if (clientCount > 0) {
      spin.succeed(`Detected ${clientCount} client${clientCount !== 1 ? "s" : ""}`);
    } else {
      spin.warn("No clients detected");
    }
  }

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

  await configManager.write(newConfig);
  ui.success("Initialization complete!");

  console.log(ui.format.summary(timer.elapsed(), `${Object.keys(newConfig.clients).length} clients configured`));

  await maybePromptAndInstallPath({
    assumeYes: options.yes,
    noPathPrompt: options.noPathPrompt,
  });
}
