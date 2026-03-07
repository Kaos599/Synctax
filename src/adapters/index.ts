import { ClaudeAdapter } from "./claude.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";
import { AntigravityAdapter } from "./antigravity.js";
import { ClientAdapter } from "../types.js";

export const adapters: Record<string, ClientAdapter> = {
  claude: new ClaudeAdapter(),
  cursor: new CursorAdapter(),
  opencode: new OpenCodeAdapter(),
  antigravity: new AntigravityAdapter(),
};

export function getAdapter(id: string): ClientAdapter | undefined {
  return adapters[id];
}
