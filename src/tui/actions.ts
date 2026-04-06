import os from "os";
import type { TuiFocus } from "./ink-types.js";
import * as commands from "../commands.js";
import type { TuiRuntimeContext } from "./runtime-context.js";

export type TuiActionId =
  | "sync" | "pull" | "profile" | "diff" | "validate" | "backup"
  | "doctor" | "watch" | "memory-sync" | "status" | "restore" | "export"
  | "import" | "add" | "remove" | "move" | "unlink" | "link" | "info"
  | "profile-use" | "profile-create" | "profile-diff";
export type TuiActionHotkey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0" | "!" | "@";

export interface TuiAction {
  id: TuiActionId;
  hotkey?: TuiActionHotkey;
  label: string;
  commandPreview: string;
  confirmTitle: string;
  confirmRisk: "low" | "medium";
  description: string;
  hint?: string;
  focus: TuiFocus;
  cliOnly?: boolean;
}

interface TuiActionDefinition extends TuiAction {
  execute(ctx: TuiRuntimeContext): Promise<void>;
}

interface TuiHotkeyActionDefinition extends Omit<TuiActionDefinition, "hotkey"> {
  hotkey: TuiActionHotkey;
}

/** Actions with assigned hotkeys — shown in the QuickActions grid */
const TUI_HOTKEY_DEFINITIONS: ReadonlyArray<TuiHotkeyActionDefinition> = [
  {
    id: "sync",
    hotkey: "1",
    label: "sync",
    commandPreview: "synctax sync",
    confirmTitle: "Push master config to all enabled clients?",
    confirmRisk: "medium",
    description: "Writes your master config to all enabled clients. Each client's existing config is overwritten atomically. A snapshot is taken first — run synctax restore to undo.",
    focus: "actions",
    async execute() {
      await commands.syncCommand({ yes: true });
    },
  },
  {
    id: "pull",
    hotkey: "2",
    label: "pull",
    commandPreview: "synctax pull --from <client>",
    confirmTitle: "Pull and merge <client> config into master?",
    confirmRisk: "medium",
    description: "Reads your source client's live config and merges it into master. Use this after making changes directly in a client like Cursor or Claude Code.",
    hint: "Pulling from your current source. Press [s] on the dashboard to change it.",
    focus: "actions",
    async execute(ctx) {
      if (ctx.invalidSource) {
        throw new Error(`Invalid source '${ctx.invalidSource}' configured for pull action.`);
      }
      await commands.pullCommand({ from: ctx.source || "claude", merge: true });
    },
  },
  {
    id: "diff",
    hotkey: "3",
    label: "diff",
    commandPreview: "synctax diff",
    confirmTitle: "Show drift between master and clients?",
    confirmRisk: "low",
    description: "Compares your master config against each enabled client's live config. Lists added, removed, and modified MCPs, agents, and skills. Nothing is written to disk.",
    focus: "actions",
    async execute() {
      await commands.diffCommand(undefined, {});
    },
  },
  {
    id: "info",
    hotkey: "4",
    label: "info",
    commandPreview: "synctax info",
    confirmTitle: "Show system intelligence table?",
    confirmRisk: "low",
    description: "Displays a table showing which clients are installed and how many MCPs, agents, and skills each one has configured.",
    focus: "actions",
    async execute() {
      await commands.infoCommand();
    },
  },
  {
    id: "doctor",
    hotkey: "5",
    label: "doctor",
    commandPreview: "synctax doctor --deep",
    confirmTitle: "Run deep diagnostic checks?",
    confirmRisk: "low",
    description: "Diagnoses common issues: missing clients, broken config paths, invalid env vars. Deep mode also verifies each MCP command is reachable on PATH.",
    focus: "actions",
    async execute() {
      await commands.doctorCommand({ deep: true });
    },
  },
  {
    id: "backup",
    hotkey: "6",
    label: "backup",
    commandPreview: "synctax backup",
    confirmTitle: "Create a backup of all client configs?",
    confirmRisk: "medium",
    description: "Archives each enabled client's current native config files into a timestamped zip bundle at ~/.synctax/backups/. Run before risky changes.",
    focus: "actions",
    async execute() {
      await commands.backupCommand({});
    },
  },
  {
    id: "profile",
    hotkey: "7",
    label: "profiles",
    commandPreview: "synctax profile list",
    confirmTitle: "List all profiles?",
    confirmRisk: "low",
    description: "Lists all named profiles with their include/exclude filters and marks the currently active one.",
    focus: "actions",
    async execute() {
      await commands.profileListCommand({});
    },
  },
  {
    id: "status",
    hotkey: "8",
    label: "status",
    commandPreview: "synctax status",
    confirmTitle: "Show current sync status?",
    confirmRisk: "low",
    description: "Shows a health overview across all clients: sync state, resource counts, and env var status at a glance.",
    focus: "actions",
    async execute() {
      await commands.statusCommand();
    },
  },
  {
    id: "memory-sync",
    hotkey: "9",
    label: "mem-sync",
    commandPreview: "synctax memory-sync --source <client>",
    confirmTitle: "Sync memory/context files from <client> to all other clients?",
    confirmRisk: "medium",
    description: "Copies the memory/context file from your source client (e.g. CLAUDE.md) to all other enabled clients in the current project directory.",
    hint: "Copies from your current source. Press [s] on the dashboard to change it.",
    focus: "actions",
    async execute(ctx) {
      await commands.memorySyncCommand({ source: ctx.source });
    },
  },
  {
    id: "watch",
    hotkey: "0",
    label: "watch",
    commandPreview: "synctax watch",
    confirmTitle: "Start background auto-sync daemon?",
    confirmRisk: "medium",
    description: "Starts a background daemon that watches ~/.synctax/config.json and auto-syncs to all clients on every save (500ms debounce).",
    focus: "actions",
    async execute() {
      await commands.watchCommand({});
    },
  },
  {
    id: "restore",
    hotkey: "!",
    label: "restore",
    commandPreview: "synctax restore",
    confirmTitle: "Restore master config from latest backup?",
    confirmRisk: "medium",
    description: "Restores your master config from the most recent backup snapshot. A full sync is triggered after restore to propagate changes.",
    hint: "Uses the latest backup. For a specific timestamp, run from CLI: synctax restore --from <ts>",
    focus: "actions",
    async execute() {
      await commands.restoreCommand({});
    },
  },
  {
    id: "export",
    hotkey: "@",
    label: "export",
    commandPreview: "synctax export ~/.synctax/export.json",
    confirmTitle: "Export master config to ~/.synctax/export.json?",
    confirmRisk: "low",
    description: "Exports the full master configuration to a portable JSON file. Credentials are automatically stripped for safety.",
    hint: "Exports to ~/.synctax/export.json. For a custom path, run from CLI: synctax export <file>",
    focus: "actions",
    async execute() {
      const synctaxHome = process.env.SYNCTAX_HOME || os.homedir();
      await commands.exportCommand(`${synctaxHome}/.synctax/export.json`);
    },
  },
];

/** Palette-only actions — no hotkey, accessible via command palette (/) */
const TUI_PALETTE_DEFINITIONS: ReadonlyArray<TuiActionDefinition> = [
  {
    id: "import",
    label: "import",
    commandPreview: "synctax import <file>",
    confirmTitle: "Import master config from a file?",
    confirmRisk: "medium",
    description: "Imports a master configuration from a JSON file, replacing your current config.",
    hint: "Requires a file path. Run from CLI: synctax import <file>",
    focus: "actions",
    cliOnly: true,
    async execute() {
      throw new Error("This command requires a file path. Run from CLI: synctax import <file>");
    },
  },
  {
    id: "add",
    label: "add",
    commandPreview: "synctax add <type> <name>",
    confirmTitle: "Add a resource?",
    confirmRisk: "medium",
    description: "Add an MCP server, agent, or skill to your master config.",
    hint: "Requires arguments. Run from CLI: synctax add mcp <name> --command <cmd>",
    focus: "actions",
    cliOnly: true,
    async execute() {
      throw new Error("This command requires arguments. Run from CLI: synctax add mcp <name> --command <cmd>");
    },
  },
  {
    id: "remove",
    label: "remove",
    commandPreview: "synctax remove <type> <name>",
    confirmTitle: "Remove a resource?",
    confirmRisk: "medium",
    description: "Remove an MCP server, agent, or skill from your master config.",
    hint: "Requires arguments. Run from CLI: synctax remove mcp <name>",
    focus: "actions",
    async execute() {
      throw new Error("Should be handled by TUI picker flow");
    },
  },
  {
    id: "move",
    label: "move",
    commandPreview: "synctax move <type> <name>",
    confirmTitle: "Change scope of a resource?",
    confirmRisk: "medium",
    description: "Move a resource between scopes (global, user, project, local).",
    hint: "Requires arguments. Run from CLI: synctax move mcp <name> --to-global",
    focus: "actions",
    cliOnly: true,
    async execute() {
      throw new Error("This command requires arguments. Run from CLI: synctax move mcp <name> --to-global");
    },
  },
  {
    id: "unlink",
    label: "unlink",
    commandPreview: "synctax unlink",
    confirmTitle: "Replace linked instruction symlinks with regular files?",
    confirmRisk: "medium",
    description: "Replaces any symlinked client instruction files (CLAUDE.md, .cursorrules, etc.) with standalone copies.",
    focus: "actions",
    async execute() {
      await commands.unlinkCommand();
    },
  },
  {
    id: "link",
    label: "link",
    commandPreview: "synctax link",
    confirmTitle: "Link client instruction files?",
    confirmRisk: "medium",
    description: "Creates symlinks so each client's instruction file (CLAUDE.md, .cursorrules, etc.) points to a single shared canonical file.",
    focus: "actions",
    async execute() {
      await commands.linkCommand();
    },
  },
  {
    id: "validate",
    label: "validate",
    commandPreview: "synctax validate",
    confirmTitle: "Run config validation checks?",
    confirmRisk: "low",
    description: "Runs Zod schema validation on master config, checks env var references can resolve, and confirms required binaries exist on PATH.",
    focus: "actions",
    async execute() {
      await commands.validateCommand({});
    },
  },
  {
    id: "profile-use",
    label: "profile use",
    commandPreview: "synctax profile use <name>",
    confirmTitle: "Switch to a profile?",
    confirmRisk: "medium",
    description: "Switches to a named profile and immediately syncs — swaps env context and include/exclude filters.",
    hint: "Requires a profile name. Run from CLI: synctax profile use <name>",
    focus: "actions",
    async execute() {
      throw new Error("Should be handled by TUI picker flow");
    },
  },
  {
    id: "profile-create",
    label: "profile create",
    commandPreview: "synctax profile create <name>",
    confirmTitle: "Create a new profile?",
    confirmRisk: "low",
    description: "Creates a named filter profile with --include / --exclude resource lists. Each profile gets its own .env file.",
    hint: "Requires a profile name. Run from CLI: synctax profile create <name> --include <resources>",
    focus: "actions",
    cliOnly: true,
    async execute() {
      throw new Error("This command requires a profile name. Run from CLI: synctax profile create <name>");
    },
  },
  {
    id: "profile-diff",
    label: "profile diff",
    commandPreview: "synctax profile diff <name>",
    confirmTitle: "Preview profile resource filter?",
    confirmRisk: "low",
    description: "Dry-run preview of what would change if you switched to this profile, without actually switching.",
    hint: "Requires a profile name. Run from CLI: synctax profile diff <name>",
    focus: "actions",
    async execute() {
      throw new Error("Should be handled by TUI picker flow");
    },
  },
];

const ALL_DEFINITIONS: ReadonlyArray<TuiActionDefinition> = [...TUI_HOTKEY_DEFINITIONS, ...TUI_PALETTE_DEFINITIONS];

const ACTION_DEFINITION_BY_ID = Object.fromEntries(
  ALL_DEFINITIONS.map((action) => [action.id, action]),
) as Readonly<Record<TuiActionId, TuiActionDefinition>>;

/** A TuiAction that is guaranteed to have a hotkey assigned */
export type TuiHotkeyAction = TuiAction & { hotkey: TuiActionHotkey };

/** Hotkey actions only — used by QuickActions grid */
export const TUI_ACTIONS: ReadonlyArray<TuiHotkeyAction> = TUI_HOTKEY_DEFINITIONS.map(({ execute: _execute, ...action }) => action);

export function getActionByHotkey(key: string): TuiHotkeyAction | undefined {
  return TUI_ACTIONS.find((action) => action.hotkey === key);
}

export async function runActionById(id: TuiActionId, ctx: TuiRuntimeContext): Promise<void> {
  await ACTION_DEFINITION_BY_ID[id].execute(ctx);
}

/** All action definitions — hotkey + palette — for command palette search */
export function getAllActions(): ReadonlyArray<TuiAction> {
  return ALL_DEFINITIONS.map(({ execute: _execute, ...action }) => action);
}
