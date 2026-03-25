export type UiMode = "rich" | "standard" | "plain";

export interface UiCapabilities {
  mode: UiMode;
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  colorEnabled: boolean;
  colorLevel: number;
  unicode: boolean;
  animate: boolean;
  isCI: boolean;
}

function envFlag(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized !== "0" && normalized !== "false";
}

function readColorDepth(): number {
  const stdout = process.stdout as { getColorDepth?: () => number };
  const stderr = process.stderr as { getColorDepth?: () => number };

  const stdoutDepth = typeof stdout.getColorDepth === "function" ? stdout.getColorDepth() : 0;
  const stderrDepth = typeof stderr.getColorDepth === "function" ? stderr.getColorDepth() : 0;
  return Math.max(stdoutDepth, stderrDepth);
}

function normalizeColorLevel(depth: number): number {
  if (depth >= 24) return 3;
  if (depth >= 8) return 2;
  if (depth >= 4) return 1;
  return 0;
}

function computeCapabilities(): UiCapabilities {
  const stdoutIsTTY = Boolean(process.stdout.isTTY);
  const stderrIsTTY = Boolean(process.stderr.isTTY);
  const isCI = envFlag("CI");
  const noColor = envFlag("NO_COLOR") || envFlag("NODE_DISABLE_COLORS");
  const forceColor = envFlag("FORCE_COLOR");
  const term = (process.env.TERM || "").toLowerCase();
  const unicodeForcedOff = envFlag("SYNCTAX_ASCII") || term === "dumb";

  const ttyColorCandidate = stdoutIsTTY || stderrIsTTY;
  const colorDepth = readColorDepth();
  const colorEnabled = !noColor && (forceColor || ttyColorCandidate || colorDepth > 0);
  const colorLevel = colorEnabled ? normalizeColorLevel(colorDepth) : 0;
  const unicode = !unicodeForcedOff;
  const animate = stderrIsTTY && !isCI;

  let mode: UiMode = "standard";
  if (!stdoutIsTTY && !stderrIsTTY) {
    mode = "plain";
  } else if (animate && unicode && colorEnabled) {
    mode = "rich";
  }

  return {
    mode,
    stdoutIsTTY,
    stderrIsTTY,
    colorEnabled,
    colorLevel,
    unicode,
    animate,
    isCI,
  };
}

export function detectCapabilities(): UiCapabilities {
  return computeCapabilities();
}

export function getCapabilities(): UiCapabilities {
  return computeCapabilities();
}

export function resetCapabilitiesForTests(): void {
  // no-op by design; capabilities are computed per call.
}
