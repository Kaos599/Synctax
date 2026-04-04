import type { TuiAction } from "./actions.js";

export type TuiHealth = "OK" | "WARN" | "FAIL";
export type TuiMode = "dashboard" | "confirm" | "running" | "result" | "help" | "palette" | "source" | "theme";
export type TuiFocus = "overview" | "quickstart" | "actions" | "diagnostics" | "features";

export type TuiPendingAction = Pick<
  TuiAction,
  "id" | "hotkey" | "label" | "commandPreview" | "confirmTitle" | "confirmRisk" | "description" | "hint"
>;

export interface TuiFrameData {
  version: string;
  profile: string;
  source: string;
  theme: string;
  health: TuiHealth;
  enabledClients: number;
  totalClients: number;
  resourceCounts: { mcps: number; agents: number; skills: number };
  driftClients: number;
  lastSync: string;
  warnings: string[];
}
