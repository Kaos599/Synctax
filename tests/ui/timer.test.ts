import { describe, it, expect } from "vitest";
import { startTimer } from "../../src/ui/timer.js";

describe("UI Timer", () => {
  it("returns elapsed time in ms for short durations", () => {
    const timer = startTimer();
    const result = timer.elapsed();
    // Should be a very small number of ms
    expect(result).toMatch(/^\d+ms$/);
  });

  it("elapsedMs returns a number", () => {
    const timer = startTimer();
    const ms = timer.elapsedMs();
    expect(typeof ms).toBe("number");
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("elapsed increases over time", async () => {
    const timer = startTimer();
    const first = timer.elapsedMs();
    // Small busy wait
    const start = performance.now();
    while (performance.now() - start < 5) { /* spin */ }
    const second = timer.elapsedMs();
    expect(second).toBeGreaterThan(first);
  });
});
