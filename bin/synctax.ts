#!/usr/bin/env bun
import { Command } from "commander";
import { printBanner } from "../src/banner.js";
import { initCommand, listCommand, statusCommand, syncCommand } from "../src/commands.js";

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
