import { afterEach, describe, expect, it, vi } from "vitest";
import { spinner } from "../../src/ui/spinner.js";

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

describe("UI spinner", () => {
  const ciEnv = process.env.CI;

  afterEach(() => {
    process.env.CI = ciEnv;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders animated frames to stderr when interactive", () => {
    process.env.CI = "";
    vi.useFakeTimers();

    const restoreStdout = setTTY(process.stdout, true);
    const restoreStderr = setTTY(process.stderr, true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const spin = spinner("working");
      vi.advanceTimersByTime(100);
      spin.stop();

      expect(stderrSpy).toHaveBeenCalled();
    } finally {
      restoreStdout();
      restoreStderr();
    }
  });

  it("does not print intermediate text updates when not interactive", () => {
    process.env.CI = "";
    const restoreStdout = setTTY(process.stdout, false);
    const restoreStderr = setTTY(process.stderr, false);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const spin = spinner("step 1");
      spin.text("step 2");
      spin.text("step 3");
      spin.succeed("done");

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(String(logSpy.mock.calls[0]?.[0] ?? "")).toContain("step 1");
      expect(String(logSpy.mock.calls[1]?.[0] ?? "")).toContain("done");
    } finally {
      restoreStdout();
      restoreStderr();
    }
  });
});
