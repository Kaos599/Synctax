import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { profileCreateCommand, profileUseCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Profiles Domain", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-profiles-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });

    manager = new ConfigManager();
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {}
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    });
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("profileCreateCommand creates a new profile", async () => {
    await profileCreateCommand("work", { include: "mcp1,mcp2", exclude: "mcp3" });

    const config = await manager.read();
    expect(config.profiles["work"]).toBeDefined();
    expect(config.profiles["work"].include).toEqual(["mcp1", "mcp2"]);
    expect(config.profiles["work"].exclude).toEqual(["mcp3"]);
  });

  it("profileUseCommand switches active profile", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {},
        personal: {}
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    });

    await profileUseCommand("personal", { noSync: true });
    const config = await manager.read();
    expect(config.activeProfile).toBe("personal");
  });


  it("syncCommand respects profile filters", async () => {
    await manager.write({
      version: 1,
      activeProfile: "work",
      clients: { mockclient: { enabled: true } },
      profiles: {
        work: { include: ["work-mcp", "work-agent"] }
      },
      resources: {
        mcps: {
          "work-mcp": { command: "work-mcp" },
          "home-mcp": { command: "home-mcp" }
        },
        agents: {
          "work-agent": { name: "Work", prompt: "Work" },
          "home-agent": { name: "Home", prompt: "Home" }
        }
      }
    });

    const { syncCommand, applyProfileFilter } = await import("../src/commands.js");
    const config = await manager.read();

    const filtered = await applyProfileFilter(config.resources, config.profiles[config.activeProfile]);

    expect(filtered.mcps["work-mcp"]).toBeDefined();
    expect(filtered.mcps["home-mcp"]).toBeUndefined();
    expect(filtered.agents["work-agent"]).toBeDefined();
    expect(filtered.agents["home-agent"]).toBeUndefined();
  });
});
