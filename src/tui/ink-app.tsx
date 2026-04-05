import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import type { TuiFrameData, TuiPendingAction } from "./ink-types.js";

export interface InkTuiOptions {
  data: TuiFrameData;
  executeAction?: (action: TuiPendingAction) => Promise<void>;
}

export async function runInkTui(options: InkTuiOptions): Promise<void> {
  // Suppress React dev-mode warnings in production TUI (noisy in terminal)
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  // Enter alternate screen buffer and hide cursor for fullscreen TUI
  process.stdout.write("\x1b[?1049h"); // Enter alternate buffer
  process.stdout.write("\x1b[?25l");   // Hide cursor

  try {
    const instance = render(
      <App data={options.data} executeAction={options.executeAction} />,
      {
        exitOnCtrlC: false,
        patchConsole: false,
      },
    );

    await instance.waitUntilExit();
  } finally {
    process.env.NODE_ENV = prevEnv;
    // Restore cursor and leave alternate screen buffer on exit
    process.stdout.write("\x1b[?25h");   // Show cursor
    process.stdout.write("\x1b[?1049l"); // Leave alternate buffer
  }
}
