import { afterEach, describe, expect, it, vi } from "vitest";
import * as inkApp from "../../src/tui/ink-app.js";
import * as data from "../../src/tui/data.js";
import * as interactive from "../../src/interactive.js";
import { startNoArgExperience } from "../../src/tui/entry.js";

function setProcessProperty<T extends object, K extends string>(target: T, key: K, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
      return;
    }

    delete (target as T & Record<string, unknown>)[key];
  };
}

describe("no-arg entry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs fullscreen TUI on interactive TTY with sufficient viewport", async () => {
    const frameData = {
      version: "0.1.0",
      profile: "default",
      source: "cursor",
      theme: "synctax",
      health: "OK" as const,
      enabledClients: 1,
      totalClients: 9,
      resourceCounts: { mcps: 1, agents: 0, skills: 0 },
      driftClients: 0,
      lastSync: "unknown",
      warnings: [],
      profileNames: ["default"],
      resourceNames: { mcps: [], agents: [], skills: [] },
    };

    const runSpy = vi.spyOn(inkApp, "runInkTui").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(data, "loadTuiFrameData").mockResolvedValue(frameData);
    const fallbackSpy = vi.spyOn(interactive, "startInteractiveMode").mockResolvedValue(undefined as never);

    const restoreStdinTTY = setProcessProperty(process.stdin, "isTTY", true);
    const restoreStdoutTTY = setProcessProperty(process.stdout, "isTTY", true);
    const restoreColumns = setProcessProperty(process.stdout, "columns", 120);
    const restoreRows = setProcessProperty(process.stdout, "rows", 36);

    try {
      await startNoArgExperience();
    } finally {
      restoreRows();
      restoreColumns();
      restoreStdoutTTY();
      restoreStdinTTY();
    }

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith({ data: frameData });
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  it("falls back to interactive mode when terminal is non-interactive", async () => {
    const runSpy = vi.spyOn(inkApp, "runInkTui").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(data, "loadTuiFrameData").mockResolvedValue({} as never);
    const fallbackSpy = vi.spyOn(interactive, "startInteractiveMode").mockResolvedValue(undefined as never);

    const restoreStdinTTY = setProcessProperty(process.stdin, "isTTY", false);
    const restoreStdoutTTY = setProcessProperty(process.stdout, "isTTY", true);
    const restoreColumns = setProcessProperty(process.stdout, "columns", 120);
    const restoreRows = setProcessProperty(process.stdout, "rows", 36);

    try {
      await startNoArgExperience();
    } finally {
      restoreRows();
      restoreColumns();
      restoreStdoutTTY();
      restoreStdinTTY();
    }

    expect(fallbackSpy).toHaveBeenCalledWith(undefined);
    expect(runSpy).not.toHaveBeenCalled();
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it("falls back on small viewport and passes through theme override", async () => {
    const runSpy = vi.spyOn(inkApp, "runInkTui").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(data, "loadTuiFrameData").mockResolvedValue({} as never);
    const fallbackSpy = vi.spyOn(interactive, "startInteractiveMode").mockResolvedValue(undefined as never);

    const restoreStdinTTY = setProcessProperty(process.stdin, "isTTY", true);
    const restoreStdoutTTY = setProcessProperty(process.stdout, "isTTY", true);
    const restoreColumns = setProcessProperty(process.stdout, "columns", 91);
    const restoreRows = setProcessProperty(process.stdout, "rows", 24);

    try {
      await startNoArgExperience("pixel");
    } finally {
      restoreRows();
      restoreColumns();
      restoreStdoutTTY();
      restoreStdinTTY();
    }

    expect(fallbackSpy).toHaveBeenCalledWith("pixel");
    expect(runSpy).not.toHaveBeenCalled();
    expect(loadSpy).not.toHaveBeenCalled();
  });
});
