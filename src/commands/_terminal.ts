import * as ui from "../ui/index.js";

export function requireInteractiveTTY(action: string): boolean {
  if (ui.isInteractive()) {
    return true;
  }

  ui.error(`${action} requires an interactive terminal (TTY).`);
  process.exitCode = 1;
  return false;
}
