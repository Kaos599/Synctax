#!/usr/bin/env bun
import { Command } from "commander";
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
  profileListCommand,
  profileDiffCommand,
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
  diffCommand,
  validateCommand,
  linkCommand,
  unlinkCommand,
  backupCommand,
  requireInteractiveTTY,
} from "../src/commands.js";
import { getVersion } from "../src/version.js";

const program = new Command();

program
  .name("synctax")
  .description("Universal Sync for the Agentic Developer Stack")
  .version(getVersion())
  .option("--theme <name>", "Banner: pixel|synctax (wordmark), or rebel|green|cyber|default (FIGlet art)");

program
  .command("init")
  .description("Initialize synctax in your environment")
  .option("--no-detect", "Skip auto-detecting installed clients")
  .option("--source <client>", "Set source of truth without prompting")
  .option("--force", "Overwrite existing config")
  .option("--theme <name>", "Banner: pixel|synctax (wordmark), or rebel|green|cyber|default (FIGlet art)")
  .option("-y, --yes", "Install PATH launcher without asking (non-interactive)")
  .option("--no-path-prompt", "Skip the PATH question and do not change PATH")
  .action(async (options) => {
    await initCommand(options);
  });

// Hidden alias: `list` still works but shows deprecation hint
program
  .command("list", { hidden: true })
  .description("List all resources in the master config")
  .action(() => {
    void listCommand();
  });

program
  .command("status")
  .description("Show the current sync status across all clients")
  .action(() => {
    void statusCommand();
  });

program
  .command("sync")
  .description("Push all resources from master to all enabled clients")
  .option("--dry-run", "Preview all changes without writing any files")
  .option("-i, --interactive", "Interactively select resources to sync")
  .action((options) => {
    void syncCommand(options);
  });


program
  .command("memory-sync")
  .description("Sync memory/context files across enabled clients in the current directory")
  .option("--source <client>", "Canonical source client for memory files")
  .option("--dry-run", "Preview changes without writing")
  .action((options) => {
    void memorySyncCommand(options);
  });

program
  .command("pull")
  .description("Import the current config of a specific client into master")
  .requiredOption("--from <client>", "Client to pull from")
  .option("--merge", "Merge pulled config with existing master (default)")
  .option("--overwrite", "Replace master config entirely")
  .option("--domain <domain>", "Pull only specific domain (mcp|agents|skills|permissions|models|prompts)")
  .option("-i, --interactive", "Interactively select resources to pull")
  .action((options) => {
    void pullCommand(options);
  });

program
  .command("move <domain> <name>")
  .description("Change scope of a resource")
  .option("--to-global", "Change scope to global")
  .option("--to-local", "Change scope to local")
  .option("--push", "Sync immediately after moving")
  .action((domain, name, options) => {
    void moveCommand(domain, name, options);
  });

const profileCmd = program.command("profile").description("Manage profiles");

profileCmd
  .command("create <name>")
  .description("Create a new profile")
  .option("--include <names>", "Comma-separated resource names to include")
  .option("--exclude <names>", "Comma-separated resource names to exclude")
  .action((name, options) => {
    void profileCreateCommand(name, options);
  });

profileCmd
  .command("use <name>")
  .description("Switch to a named profile and sync all clients")
  .option("--dry-run", "Preview what would change")
  .option("--no-sync", "Switch profile without syncing clients yet")
  .action((name, options) => {
    void profileUseCommand(name, options);
  });

profileCmd
  .command("list")
  .description("List profiles with active marker and filters")
  .option("--json", "Print as JSON")
  .action((options) => {
    void profileListCommand(options);
  });

profileCmd
  .command("diff <name>")
  .description("Preview resources included/excluded by a profile")
  .option("--json", "Print as JSON")
  .action((name, options) => {
    void profileDiffCommand(name, options);
  });

program
  .command("add <domain> <name>")
  .description("Add a resource")
  .option("--command <cmd>")
  .option("--from <url>", "Import MCP definition from URL")
  .option("--push")
  .action((domain, name, options) => {
    void addCommand(domain, name, options);
  });

program
  .command("remove [domain] [name]")
  .description("Remove a resource")
  .option("--dry-run")
  .option("--from-all")
  .option("-i, --interactive", "Interactively select resources to remove")
  .action((domain, name, options) => {
    void removeCommand(domain, name, options);
  });

program
  .command("restore")
  .description("Restore config from backup")
  .option("--from <timestamp>")
  .action((options) => {
    void restoreCommand(options);
  });

program
  .command("doctor")
  .description("Diagnose common issues")
  .option("--fix", "Attempt to automatically fix detected issues")
  .option("--deep", "Run deep MCP command and env validation")
  .action((options) => {
    void doctorCommand(options);
  });

profileCmd
  .command("pull <url>")
  .description("Download and import a profile from a remote URL")
  .option("--name <name>", "Override the profile name")
  .option("--apply", "Immediately switch to and sync")
  .action((url, options) => {
    void profilePullCommand(url, options);
  });

profileCmd
  .command("publish <name>")
  .description("Export a profile to a shareable JSON file")
  .option("--output <path>", "File path to save the export")
  .action((name, options) => {
    void profilePublishCommand(name, options);
  });

// Hidden alias: `info` still works but shows deprecation hint
program
  .command("info", { hidden: true })
  .description("Display tabular system intelligence (installed clients and resource counts)")
  .action(() => {
    void infoCommand();
  });

program
  .command("watch")
  .description("Run a background daemon that auto-syncs when master config changes")
  .action((options) => {
    void watchCommand(options);
  });

program
  .command("export <file>")
  .description("Export the entire master configuration to a JSON file")
  .action(async (file) => {
    await exportCommand(file);
  });

program
  .command("diff [client]")
  .description("Show add/remove/modify drift for mcps, agents, and skills")
  .option("--json", "Print as JSON")
  .action((client, options) => {
    void diffCommand(client, options);
  });

program
  .command("validate")
  .description("Validate config integrity and client/tool prerequisites")
  .option("--strict", "Enable stricter validation checks")
  .action(async (options) => {
    const healthy = await validateCommand(options);
    if (!healthy) {
      process.exitCode = 1;
    }
  });

program
  .command("link")
  .description("Link client instruction files to a shared canonical file")
  .action(async () => {
    await linkCommand();
  });

program
  .command("unlink")
  .description("Replace linked instruction symlinks with regular files")
  .action(async () => {
    await unlinkCommand();
  });

program
  .command("import <file>")
  .description("Import the entire master configuration from a JSON file")
  .action(async (file) => {
    await importCommand(file);
  });

program
  .command("backup")
  .description("Backup native client files (bundle by default)")
  .option("--client <id>", "Select client id (repeatable)", (value, previous: string[] = []) => [...previous, value])
  .option("-i, --interactive", "Interactively select clients")
  .option("--layout <mode>", "Backup layout: bundle|per-client", "bundle")
  .option("--output <path>", "Output zip path (bundle) or output directory (per-client)")
  .option("--rollup", "Write additional rollup manifest artifact")
  .action(async (options) => {
    await backupCommand(options);
  });

if (process.argv.length <= 2 || (process.argv.length === 4 && process.argv[2] === "--theme")) {
  if (!requireInteractiveTTY("interactive mode")) {
    process.exit(process.exitCode || 1);
  }

  let themeOverride = undefined;
  if (process.argv.length === 4 && process.argv[2] === "--theme") {
    themeOverride = process.argv[3];
  }
  void import("../src/interactive.js").then(({ startInteractiveMode }) => {
    startInteractiveMode(themeOverride).catch((err) => {
      const cancelNames = ["ExitPromptError", "CancelPromptError", "AbortPromptError"];
      if (!cancelNames.includes(err.name)) {
        console.error(err);
      }
    });
  });
} else {
  program.parse(process.argv);
}
