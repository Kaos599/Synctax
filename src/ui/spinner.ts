/** Minimal spinner for async operations. Uses semantic colors from the UI palette. */

import { semantic, symbols } from "./colors.js";
import { getCapabilities } from "./capabilities.js";

export interface SpinnerInstance {
  text(msg: string): void;
  succeed(msg: string): void;
  fail(msg: string): void;
  warn(msg: string): void;
  stop(): void;
}

const unicodeFrames = ["\u28CB", "\u28D9", "\u28F9", "\u28F8", "\u28FC", "\u28F4", "\u28E6", "\u28E7", "\u28C7", "\u28CF"];
const asciiFrames = ["-", "\\", "|", "/"];

function usePlainOutputMode(): boolean {
  return process.env.SYNCTAX_TUI_PLAIN_OUTPUT === "1";
}

export function spinner(text: string): SpinnerInstance {
  const capabilities = getCapabilities();
  const stream = process.stderr;
  const frames = capabilities.unicode ? unicodeFrames : asciiFrames;
  const ellipsis = capabilities.unicode ? "…" : "...";
  const canAnimate = capabilities.animate && !usePlainOutputMode();

  let frameIndex = 0;
  let currentText = text;
  let stopped = false;

  const interval = canAnimate
    ? setInterval(() => {
        const frame = frames[frameIndex % frames.length] ?? "*";
        stream.write(`\r  ${semantic.info(frame)} ${currentText}`);
        frameIndex++;
      }, 80)
    : null;

  if (!canAnimate) {
    console.log(`  ${semantic.info(ellipsis)} ${text}`);
  }

  function clearTransientLine() {
    if (interval) clearInterval(interval);
    if (canAnimate) {
      stream.write("\r\x1b[K");
    }
  }

  function finish(type: "success" | "error" | "warning", msg: string) {
    if (stopped) {
      return;
    }
    stopped = true;
    clearTransientLine();

    if (type === "success") {
      console.log(`  ${semantic.success(symbols.success)} ${msg}`);
      return;
    }
    if (type === "error") {
      console.log(`  ${semantic.error(symbols.error)} ${msg}`);
      return;
    }
    console.log(`  ${semantic.warning(symbols.warning)} ${msg}`);
  }

  return {
    text(msg: string) {
      if (stopped) {
        return;
      }
      currentText = msg;
    },
    succeed(msg: string) {
      finish("success", msg);
    },
    fail(msg: string) {
      finish("error", msg);
    },
    warn(msg: string) {
      finish("warning", msg);
    },
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      clearTransientLine();
    },
  };
}

export function isInteractive(): boolean {
  if (usePlainOutputMode()) {
    return false;
  }
  const capabilities = getCapabilities();
  return capabilities.stdoutIsTTY || capabilities.stderrIsTTY;
}
