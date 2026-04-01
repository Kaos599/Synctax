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
    confirmTitle: "Pull and merge client config into master?",
    confirmRisk: "medium",
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
    focus: "actions",
    async execute() {
      await commands.statusCommand();
    },
  },
  {
    id: "memory-sync",
    hotkey: "9",
    label: "mem-sync",
    commandPreview: "synctax memory-sync",
    confirmTitle: "Sync memory/context files across clients?",
    confirmRisk: "medium",
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
