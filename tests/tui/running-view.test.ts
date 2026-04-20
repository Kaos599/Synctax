import { describe, it, expect } from "vitest";
import { clampScrollOffset } from "../../src/tui/components/RunningView.js";

describe("RunningView scroll offset clamping", () => {
  it("caps offsets above maxOffset", () => {
    expect(clampScrollOffset(12, 5)).toBe(5);
  });

  it("normalizes negative offsets to zero", () => {
    expect(clampScrollOffset(-3, 5)).toBe(0);
  });

  it("keeps in-range offsets unchanged", () => {
    expect(clampScrollOffset(3, 5)).toBe(3);
  });
});
