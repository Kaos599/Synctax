import { describe, expect, it } from "vitest";
import { runGuardedAction } from "../../src/tui/executor.js";

describe("tui executor", () => {
  it("captures console output and returns success", async () => {
    const result = await runGuardedAction("sync", async () => {
      console.log("line-1");
    });

    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("line-1");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("captures thrown errors as failed result", async () => {
    const result = await runGuardedAction("sync", async () => {
      throw new Error("boom");
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("boom");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("fails fast when another capture is already in progress", async () => {
    let releaseFirst: (() => void) | undefined;
    const first = runGuardedAction("sync", async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });

    await Promise.resolve();

    const second = await runGuardedAction("pull", async () => {
      return;
    });

    expect(second.ok).toBe(false);
    expect(second.error).toContain("busy");

    releaseFirst?.();
    const firstResult = await first;
    expect(firstResult.ok).toBe(true);
  });

  it("captures direct stderr writes used by spinner output", async () => {
    const result = await runGuardedAction("sync", async () => {
      process.stderr.write("\rspin-line");
    });

    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("spin-line");
  });
});
