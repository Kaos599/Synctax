import { search, input, select } from "@inquirer/prompts";
import * as ui from "./ui/index.js";
import {
  initCommand,
  listCommand,
  statusCommand,
  syncCommand,
  memorySyncCommand,
  pullCommand,
  moveCommand,
  profileCreateCommand,
  profileUseCommand,
  addCommand,
  removeCommand,
  restoreCommand,
  doctorCommand,
  infoCommand,
  profilePullCommand,
  profilePublishCommand,
  watchCommand,
  exportCommand,
  importCommand,
} from "./commands.js";
import { adapters } from "./adapters/index.js";
import { printBanner } from "./banner.js";
import { ConfigManager } from "./config.js";

const commandsList = [
  { value: 'status', name: 'status', description: 'Show the current sync status across all clients' },
  { value: 'sync', name: 'sync', description: 'Push all resources from master to all enabled clients' },
  { value: 'list', name: 'list', description: 'List all resources in the master config' },
  { value: 'pull', name: 'pull', description: 'Import the current config of a specific client into master' },
  { value: 'add', name: 'add', description: 'Add a resource' },
  { value: 'remove', name: 'remove', description: 'Remove a resource' },
  { value: 'move', name: 'move', description: 'Change scope of a resource' },
  { value: 'info', name: 'info', description: 'Display tabular system intelligence (installed clients and resource counts)' },
  { value: 'watch', name: 'watch', description: 'Run a background daemon that auto-syncs when master config changes' },
  { value: 'memory-sync', name: 'memory-sync', description: 'Sync memory/context files across enabled clients in the current directory' },
  { value: 'profile:use', name: 'profile use', description: 'Switch to a named profile and sync all clients' },
  { value: 'profile:create', name: 'profile create', description: 'Create a new profile' },
  { value: 'profile:pull', name: 'profile pull', description: 'Download and import a profile from a remote URL' },
  { value: 'profile:publish', name: 'profile publish', description: 'Export a profile to a shareable JSON file' },
  { value: 'doctor', name: 'doctor', description: 'Diagnose common issues' },
  { value: 'restore', name: 'restore', description: 'Restore config from backup' },
  { value: 'export', name: 'export', description: 'Export the entire master configuration to a JSON file' },
  { value: 'import', name: 'import', description: 'Import the entire master configuration from a JSON file' },
  { value: 'init', name: 'init', description: 'Initialize synctax in your environment' },
];

export async function startInteractiveMode(themeOverride?: string) {
  const configManager = new ConfigManager();
  let theme = themeOverride || "rebel";
  let hasConfig = false;
  if (!themeOverride) {
    try {
      const config = await configManager.read();
      if (config && config.theme) {
        theme = config.theme;
        hasConfig = true;
      }
    } catch (e) {
      // ignore
    }
  }
  
  printBanner(theme);

  let selectedCommand: string;
  try {
    selectedCommand = await search({
      message: 'Select a command to run:',
      source: async (term) => {
        if (!term) return commandsList;
        return commandsList.filter((cmd) =>
          cmd.name.toLowerCase().includes(term.toLowerCase()) ||
          cmd.description.toLowerCase().includes(term.toLowerCase())
        );
      }
    });
  } catch (err: any) {
    if (isPromptCancellation(err)) {
      console.log(ui.format.warn("\nCancelled.", { prefix: "" }));
      return;
    }
    throw err;
  }

  try {
    switch (selectedCommand) {
    case 'init':
      await initCommand({ skipBanner: true });
      break;
    case 'list':
      await listCommand();
      break;
    case 'status':
      await statusCommand();
      break;
    case 'sync':
      await syncCommand({ interactive: true });
      break;
    case 'memory-sync':
      await memorySyncCommand({});
      break;
    case 'pull': {
      const clientIds = Object.keys(adapters);
      const from = await select({
        message: 'Client to pull from:',
        choices: clientIds.map(id => ({ name: adapters[id].name, value: id }))
      });
      await pullCommand({ from, interactive: true });
      break;
    }
    case 'move': {
      const domain = await select({
        message: 'Domain:',
        choices: [
          { name: 'MCP', value: 'mcp' },
          { name: 'Agent', value: 'agent' },
        ]
      });
      const name = await input({ message: 'Resource name:' });
      const scopeAction = await select({
        message: 'New scope:',
        choices: [
          { name: 'Global', value: 'toGlobal' },
          { name: 'Local', value: 'toLocal' },
        ]
      });
      await moveCommand(domain, name, { 
        toGlobal: scopeAction === 'toGlobal', 
        toLocal: scopeAction === 'toLocal' 
      });
      break;
    }
    case 'profile:create': {
      const name = await input({ message: 'Profile name:' });
      await profileCreateCommand(name, {});
      break;
    }
    case 'profile:use': {
      if (!hasConfig) {
        console.log(ui.format.warn("No configuration found. Please initialize first.", { prefix: "" }));
        break;
      }
      const config = await configManager.read();
      const profileNames = Object.keys(config.profiles || {});
      if (profileNames.length === 0) {
        console.log(ui.format.warn("No profiles found.", { prefix: "" }));
        break;
      }
      const name = await select({
        message: 'Select profile to use:',
        choices: profileNames.map(p => ({ name: p, value: p }))
      });
      await profileUseCommand(name, {});
      break;
    }
    case 'profile:pull': {
      const url = await input({ message: 'Profile URL:' });
      await profilePullCommand(url, { apply: true });
      break;
    }
    case 'profile:publish': {
      if (!hasConfig) {
        console.log(ui.format.warn("No configuration found. Please initialize first.", { prefix: "" }));
        break;
      }
      const config = await configManager.read();
      const profileNames = Object.keys(config.profiles || {});
      if (profileNames.length === 0) {
        console.log(ui.format.warn("No profiles found.", { prefix: "" }));
        break;
      }
      const name = await select({
        message: 'Select profile to publish:',
        choices: profileNames.map(p => ({ name: p, value: p }))
      });
      await profilePublishCommand(name, {});
      break;
    }
    case 'add': {
      const domain = await select({
        message: 'Domain:',
        choices: [
          { name: 'MCP', value: 'mcp' },
          { name: 'Agent', value: 'agent' },
          { name: 'Skill', value: 'skill' },
        ]
      });
      const name = await input({ message: 'Resource name:' });
      if (domain === 'mcp') {
        const command = await input({ message: 'Command (e.g., npx):' });
        await addCommand(domain, name, { command });
      } else {
        await addCommand(domain, name, {});
      }
      break;
    }
    case 'remove': {
      // Use interactive mode of removeCommand which prompts for resources
      await removeCommand(undefined, undefined, { interactive: true });
      break;
    }
    case 'restore':
      await restoreCommand({});
      break;
    case 'doctor':
      await doctorCommand({});
      break;
    case 'info':
      await infoCommand();
      break;
    case 'watch':
      await watchCommand({});
      break;
    case 'export': {
      const file = await input({ message: 'Output file path (e.g., config.json):', default: 'config.json' });
      await exportCommand(file);
      break;
    }
    case 'import': {
      const file = await input({ message: 'Input file path (e.g., config.json):' });
      await importCommand(file);
      break;
    }
  }
  } catch (err: any) {
    if (isPromptCancellation(err)) {
      console.log(ui.format.warn("\nCancelled.", { prefix: "" }));
      return;
    }
    throw err;
  }
}

function isPromptCancellation(err: any): boolean {
  return ["ExitPromptError", "CancelPromptError", "AbortPromptError"].includes(err?.name);
}