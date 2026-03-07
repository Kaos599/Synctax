import { ClaudeAdapter } from "./claude.js";
import { CursorAdapter } from "./cursor.js";
import { ClientAdapter } from "../types.js";

export const adapters: Record<string, ClientAdapter> = {
  claude: new ClaudeAdapter(),
  cursor: new CursorAdapter(),
};

export function getAdapter(id: string): ClientAdapter | undefined {
  return adapters[id];
}
