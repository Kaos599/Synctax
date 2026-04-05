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

type CanonicalAdapters = {
  claude: ClientAdapter;
  cursor: ClientAdapter;
  opencode: ClientAdapter;
  antigravity: ClientAdapter;
  cline: ClientAdapter;
  zed: ClientAdapter;
  "github-copilot": ClientAdapter;
  "github-copilot-cli": ClientAdapter;
  "gemini-cli": ClientAdapter;
};

const BASE_ADAPTERS: CanonicalAdapters = {
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

export type AdapterId = keyof typeof BASE_ADAPTERS;

export type AdapterRegistry = CanonicalAdapters & Record<string, ClientAdapter>;

export const adapters: AdapterRegistry = {
  ...BASE_ADAPTERS,
};

export function getAdapter(id: AdapterId): ClientAdapter;
export function getAdapter(id: string): ClientAdapter | undefined;
export function getAdapter(id: string): ClientAdapter | undefined {
  return adapters[id];
}
