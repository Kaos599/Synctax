import { ClaudeAdapter } from "./claude.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";
import { AntigravityAdapter } from "./antigravity.js";
import { ClineAdapter } from "./cline.js";
import { ZedAdapter } from "./zed.js";
import { GithubCopilotAdapter } from "./github-copilot.js";
import { GithubCopilotCliAdapter } from "./github-copilot-cli.js";
import { GeminiCliAdapter } from "./gemini-cli.js";
import type { ClientAdapter } from "../types.js";

export const adapters: Record<string, ClientAdapter> = {
  claude: new ClaudeAdapter(),
  cursor: new CursorAdapter(),
  opencode: new OpenCodeAdapter(),
  antigravity: new AntigravityAdapter(),
  cline: new ClineAdapter(),
  zed: new ZedAdapter(),
  "github-copilot": new GithubCopilotAdapter(),
  "github-copilot-cli": new GithubCopilotCliAdapter(),
  "gemini-cli": new GeminiCliAdapter(),
};

export function getAdapter(id: string): ClientAdapter | undefined {
  return adapters[id];
}
