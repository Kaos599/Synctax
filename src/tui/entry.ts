import { startInteractiveMode } from "../interactive.js";
import { runInkTui } from "./ink-app.js";
import { loadTuiFrameData } from "./data.js";
import { setActiveTheme } from "./theme.js";
import * as ui from "../ui/index.js";

const MIN_FULLSCREEN_WIDTH = 92;
const MIN_FULLSCREEN_HEIGHT = 24;

export async function startNoArgExperience(themeOverride?: string): Promise<void> {
  const hasTty = Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
  const hasViewport =
    (process.stdout.columns || 0) >= MIN_FULLSCREEN_WIDTH
    && (process.stdout.rows || 0) >= MIN_FULLSCREEN_HEIGHT;

  if (hasTty && hasViewport) {
    const data = await loadTuiFrameData();
    setActiveTheme(themeOverride ?? data.theme);
    await runInkTui({ data });
    return;
  }

  if (hasTty && !hasViewport) {
    const cols = process.stdout.columns || 0;
    const rows = process.stdout.rows || 0;
    ui.dim(`Terminal too small for TUI (need ${MIN_FULLSCREEN_WIDTH}x${MIN_FULLSCREEN_HEIGHT}, got ${cols}x${rows}). Using interactive mode.`);
  }
  await startInteractiveMode(themeOverride);
}
