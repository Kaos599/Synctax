import { describe, it, expect, vi } from "vitest";
import { initCommand } from "../src/commands/init.js";
import { adapters } from "../src/adapters/index.js";
import * as shared from "../src/commands/_shared.js";

describe("init performance", () => {
  it("detects adapters in parallel", async () => {
    vi.spyOn(shared, "getConfigManager").mockReturnValue({
      read: async () => ({ activeProfile: "default", clients: {} }),
      write: async () => {},
      backup: async () => {},
    } as any);

    const adapterEntries = Object.entries(adapters);

    // Mock the detect method on all adapters to take 50ms each
    for (const [, adapter] of adapterEntries) {
      vi.spyOn(adapter, "detect").mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return true;
      });
    }

    const start = Date.now();
    await initCommand({ yes: true, skipBanner: true });
    const end = Date.now();

    const duration = end - start;

    // If sequential, duration would be ~ 50ms * number of adapters (~9-10) -> ~450ms+
    // Since there are 9 adapters, it would take ~450ms
    // With parallel Promise.all, it should complete slightly above ~50ms
    expect(duration).toBeLessThan(150);
  });
});
