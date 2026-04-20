import { describe, it, expect } from "vitest";
import { clampScrollOffset, getResultMaxVisible, isResultScrollable } from "../../src/tui/components/RunningView.js";

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

  it("computes visible result lines from terminal height", () => {
    expect(getResultMaxVisible(36)).toBe(27);
  });

  it("reports non-scrollable output when it fits", () => {
    expect(isResultScrollable(10, 36)).toBe(false);
  });

  it("reports scrollable output when lines exceed viewport", () => {
    expect(isResultScrollable(28, 36)).toBe(true);
  });
});
