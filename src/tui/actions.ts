import type { TuiFocus } from "./ink-types.js";
import * as commands from "../commands.js";
import type { TuiRuntimeContext } from "./runtime-context.js";

export type TuiActionId =
  | "sync" | "pull" | "profile" | "diff" | "validate" | "backup"
  | "doctor" | "watch" | "memory-sync" | "status" | "info" | "link";
export type TuiActionHotkey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0" | "!" | "@";

export interface TuiAction {
  id: TuiActionId;
  hotkey: TuiActionHotkey;
  label: string;
  commandPreview: string;
  confirmTitle: string;
  confirmRisk: "low" | "medium";
  description: string;
  hint?: string;
  focus: TuiFocus;
}

interface TuiActionDefinition extends TuiAction {
  execute(ctx: TuiRuntimeContext): Promise<void>;
}

const TUI_ACTION_DEFINITIONS: ReadonlyArray<TuiActionDefinition> = [
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
      await commands.syncCommand({});
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
    id: "validate",
    hotkey: "4",
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
    id: "link",
    hotkey: "!",
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
    id: "info",
    hotkey: "@",
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
];

const ACTION_DEFINITION_BY_ID = Object.fromEntries(
  TUI_ACTION_DEFINITIONS.map((action) => [action.id, action]),
) as Readonly<Record<TuiActionId, TuiActionDefinition>>;

export const TUI_ACTIONS: ReadonlyArray<TuiAction> = TUI_ACTION_DEFINITIONS.map(({ execute: _execute, ...action }) => action);

export function getActionByHotkey(key: string): TuiAction | undefined {
  return TUI_ACTIONS.find((action) => action.hotkey === key);
}

export async function runActionById(id: TuiActionId, ctx: TuiRuntimeContext): Promise<void> {
  await ACTION_DEFINITION_BY_ID[id].execute(ctx);
}

/** All action definitions for command palette search */
export function getAllActions(): ReadonlyArray<TuiAction> {
  return TUI_ACTIONS;
}
