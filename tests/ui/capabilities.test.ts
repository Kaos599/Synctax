import { afterEach, describe, expect, it } from "vitest";
import { detectCapabilities } from "../../src/ui/capabilities.js";

function setTTY(stream: NodeJS.WriteStream, value: boolean): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(stream, "isTTY");
  Object.defineProperty(stream, "isTTY", { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(stream, "isTTY", descriptor);
      return;
    }

    delete (stream as { isTTY?: boolean }).isTTY;
  };
}

describe("UI capabilities", () => {
  const envKeys = ["CI", "NO_COLOR", "FORCE_COLOR", "SYNCTAX_ASCII", "TERM"] as const;
  const envBackup = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      const previous = envBackup[key];
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  });

  it("detects plain mode in non-TTY", () => {
    const restoreStdout = setTTY(process.stdout, false);
    const restoreStderr = setTTY(process.stderr, false);

    try {
      const caps = detectCapabilities();
      expect(caps.mode).toBe("plain");
      expect(caps.animate).toBe(false);
    } finally {
      restoreStdout();
      restoreStderr();
    }
  });

  it("disables unicode when TERM is dumb", () => {
    const restoreStdout = setTTY(process.stdout, true);
    const restoreStderr = setTTY(process.stderr, true);
    process.env.TERM = "dumb";

    try {
      const caps = detectCapabilities();
      expect(caps.unicode).toBe(false);
    } finally {
      restoreStdout();
      restoreStderr();
    }
  });
});
