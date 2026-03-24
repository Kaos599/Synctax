/** Minimal spinner for async operations. Uses a simple interval-based approach to avoid adding ora as a dependency until Phase 2. */

import chalk from "chalk";

export interface SpinnerInstance {
  text(msg: string): void;
  succeed(msg: string): void;
  fail(msg: string): void;
  warn(msg: string): void;
  stop(): void;
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinner(text: string): SpinnerInstance {
  let frameIndex = 0;
  let currentText = text;
  const isTTY = Boolean(process.stdout.isTTY);

  const interval = isTTY
    ? setInterval(() => {
        const frame = frames[frameIndex % frames.length]!;
        process.stdout.write(`\r  ${chalk.cyan(frame)} ${currentText}`);
        frameIndex++;
      }, 80)
    : null;

  if (!isTTY) {
    console.log(`  … ${text}`);
  }

  function clear() {
    if (interval) clearInterval(interval);
    if (isTTY) process.stdout.write("\r\x1b[K");
  }

  return {
    text(msg: string) {
      currentText = msg;
      if (!isTTY) console.log(`  … ${msg}`);
    },
    succeed(msg: string) {
      clear();
      console.log(`  ${chalk.green("✓")} ${msg}`);
    },
    fail(msg: string) {
      clear();
      console.log(`  ${chalk.red("✗")} ${msg}`);
    },
    warn(msg: string) {
      clear();
      console.log(`  ${chalk.yellow("⚠")} ${msg}`);
    },
    stop() {
      clear();
    },
  };
}

export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY);
}
