#!/usr/bin/env bun
import { Command } from "commander";
import { printBanner } from "../src/banner.js";
import { initCommand, listCommand, statusCommand, syncCommand, memorySyncCommand, pullCommand, moveCommand, profileCreateCommand, profileUseCommand } from "../src/commands.js";

printBanner();

const program = new Command();

program
  .name("synctax")
  .description("Universal Sync for the Agentic Developer Stack")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize synctax in your environment")
  .option("--no-detect", "Skip auto-detecting installed clients")
  .option("--source <client>", "Set source of truth without prompting")
  .option("--force", "Overwrite existing config")
  .action((options) => {
    initCommand(options);
  });

program
  .command("list")
  .description("List all resources in the master config")
  .action(() => {
    listCommand();
  });

program
  .command("status")
  .description("Show the current sync status across all clients")
  .action(() => {
    statusCommand();
  });

program
  .command("sync")
  .description("Push all resources from master to all enabled clients")
  .option("--dry-run", "Preview all changes without writing any files")
  .action((options) => {
    syncCommand(options);
  });

program.parse(process.argv);

program
  .command("memory-sync")
  .description("Sync memory/context files across enabled clients in the current directory")
  .option("--source <client>", "Canonical source client for memory files")
  .option("--dry-run", "Preview changes without writing")
  .action((options) => {
    memorySyncCommand(options);
  });

program
  .command("pull")
  .description("Import the current config of a specific client into master")
  .requiredOption("--from <client>", "Client to pull from")
  .option("--merge", "Merge pulled config with existing master (default)")
  .option("--overwrite", "Replace master config entirely")
  .option("--domain <domain>", "Pull only specific domain (mcp, agents)")
  .action((options) => {
    pullCommand(options);
  });

program
  .command("move <domain> <name>")
  .description("Change scope of a resource")
  .option("--to-global", "Change scope to global")
  .option("--to-local", "Change scope to local")
  .option("--push", "Sync immediately after moving")
  .action((domain, name, options) => {
    moveCommand(domain, name, options);
  });

const profileCmd = program.command("profile").description("Manage profiles");

profileCmd
  .command("create <name>")
  .description("Create a new profile")
  .option("--include <names>", "Comma-separated resource names to include")
  .option("--exclude <names>", "Comma-separated resource names to exclude")
  .action((name, options) => {
    profileCreateCommand(name, options);
  });

profileCmd
  .command("use <name>")
  .description("Switch to a named profile and sync all clients")
  .option("--dry-run", "Preview what would change")
  .option("--no-sync", "Switch profile without syncing clients yet")
  .action((name, options) => {
    profileUseCommand(name, options);
  });
