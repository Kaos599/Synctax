import * as ui from "../ui/index.js";
import type { Config } from "../types.js";
import { printBanner } from "../banner.js";
import { maybePromptAndInstallPath } from "../install-path.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";
import { select } from "@inquirer/prompts";
import { resolveClientId } from "../client-id.js";

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
    printBanner(options.theme || "synctax");
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

  const sourceResolution = resolveClientId(options.source);
  if (sourceResolution?.ambiguousIds && options.source && !adapters[options.source]) {
    ui.error(`Ambiguous client alias "${options.source}". Use one of: ${sourceResolution.ambiguousIds.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const resolvedSource = sourceResolution?.canonicalId ?? options.source;

  const newConfig: Config = {
    version: 1,
    source: resolvedSource,
    theme: options.theme || "synctax",
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

    // Performance optimization: Parallelize adapter detection.
    // Instead of sequentially waiting for each adapter.detect(), we run them all concurrently.
    // This reduces the total detection time from O(N) to O(1) in terms of I/O latency,
    // significantly speeding up the initialization process when multiple adapters are present.
    const detectResults = await Promise.all(
      Object.entries(adapters).map(async ([id, adapter]) => ({
        id,
        adapter,
        detected: await adapter.detect(),
      }))
    );

    for (const { id, adapter, detected } of detectResults) {
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

  await configManager.write(newConfig);
  ui.success("Initialization complete!");

  console.log(ui.format.summary(timer.elapsed(), `${Object.keys(newConfig.clients).length} clients configured`));

  await maybePromptAndInstallPath({
    assumeYes: options.yes,
    noPathPrompt: options.noPathPrompt,
  });
}
