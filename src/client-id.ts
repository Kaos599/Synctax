const CLIENT_ID_ALIASES: Record<string, string[]> = {
  claude: [
    "claude",
    "claude-code",
    "claudecode",
    "anthropic-claude",
    "anthropic-claude-code",
  ],
  cursor: [
    "cursor",
    "cursor-ide",
    "cursorai",
  ],
  opencode: [
    "opencode",
    "open-code",
    "open-code-ai",
    "open-code-ide",
    "open-code-agent",
    "open-code-cli",
  ],
  antigravity: [
    "antigravity",
    "anti-gravity",
    "antigravity-ai",
  ],
  cline: [
    "cline",
    "c-line",
  ],
  zed: [
    "zed",
    "zed-editor",
  ],
  "github-copilot": [
    "github-copilot",
    "githubcopilot",
    "github-copilot-chat",
    "copilot-vscode",
    "vscode-copilot",
    "copilot-ide",
  ],
  "github-copilot-cli": [
    "github-copilot-cli",
    "githubcopilotcli",
    "copilot-cli",
    "gh-copilot-cli",
  ],
  "gemini-cli": [
    "gemini-cli",
    "gemini",
    "google-gemini-cli",
  ],
};

const AMBIGUOUS_ALIASES: Record<string, string[]> = {
  copilot: ["github-copilot", "github-copilot-cli"],
};

const aliasLookup = new Map<string, string>();
for (const [canonicalId, aliases] of Object.entries(CLIENT_ID_ALIASES)) {
  for (const alias of aliases) {
    aliasLookup.set(alias, canonicalId);
  }
}

export type ClientIdResolution = {
  input: string;
  normalized: string;
  canonicalId?: string;
  ambiguousIds?: string[];
};

export function normalizeClientToken(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveClientId(input?: string): ClientIdResolution | undefined {
  if (!input) return undefined;
  const normalized = normalizeClientToken(input);
  if (!normalized) return undefined;

  const ambiguousIds = AMBIGUOUS_ALIASES[normalized];
  if (ambiguousIds) {
    return {
      input,
      normalized,
      ambiguousIds,
    };
  }

  const canonicalId = aliasLookup.get(normalized);
  return {
    input,
    normalized,
    canonicalId,
  };
}
