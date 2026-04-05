import { startInteractiveMode } from "../interactive.js";
import { runInkTui } from "./ink-app.js";
import { loadTuiFrameData } from "./data.js";
import { setActiveTheme } from "./theme.js";
import * as ui from "../ui/index.js";

const MIN_FULLSCREEN_WIDTH = 80;
const MIN_FULLSCREEN_HEIGHT = 24;

// On Windows, npm's global bin wrapper sometimes gives stdout.columns = 0
// while stderr.columns is correctly set. Fall back to stderr, then env var.
function terminalColumns(): number {
  return (
    process.stdout.columns
    || process.stderr.columns
    || Number(process.env["COLUMNS"] ?? 0)
    || 80
  );
}

function terminalRows(): number {
  return (
    process.stdout.rows
    || process.stderr.rows
    || Number(process.env["LINES"] ?? 0)
    || 24
  );
}

export async function startNoArgExperience(themeOverride?: string): Promise<void> {
  const hasTty = Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
  const cols = terminalColumns();
  const rows = terminalRows();
  const hasViewport = cols >= MIN_FULLSCREEN_WIDTH && rows >= MIN_FULLSCREEN_HEIGHT;

  if (hasTty && hasViewport) {
    const data = await loadTuiFrameData();
    setActiveTheme(themeOverride ?? data.theme);
    await runInkTui({ data });
    return;
  }

  if (hasTty && !hasViewport) {
    ui.warn(`Terminal too small for TUI (need ${MIN_FULLSCREEN_WIDTH}x${MIN_FULLSCREEN_HEIGHT}, got ${cols}x${rows}). Using interactive mode.`);
  }
  await startInteractiveMode(themeOverride);
}
