import { describe, it, expect } from "vitest";
import { applyProfileFilter, resolveProfile } from "../src/commands.js";

describe("Profile Resolver", () => {
  it("resolves extends chain with child precedence", async () => {
    const profiles = {
      base: { include: ["base-mcp", "base-agent"], exclude: ["base-skill"] },
      child: { extends: "base", include: ["child-mcp"] },
      grandchild: { extends: "child", exclude: ["grandchild-skill"] },
    };

    const resolved = resolveProfile(profiles, "grandchild");

    expect(resolved.include).toEqual(["child-mcp"]);
    expect(resolved.exclude).toEqual(["grandchild-skill"]);
    expect(resolved.extends).toBe("child");
  });

  it("throws on circular extends", async () => {
    const profiles = {
      a: { extends: "b" },
      b: { extends: "a" },
    };

    expect(() => resolveProfile(profiles, "a")).toThrow(/Circular profile extends/i);
  });

  it("throws when active profile is missing", async () => {
    const profiles = {
      default: {},
    };

    expect(() => resolveProfile(profiles, "work")).toThrow(/Active profile "work" not found/i);
  });

  it("throws when extends target is missing with chain context", async () => {
    const profiles = {
      parent: { extends: "missing" },
    };

    expect(() => resolveProfile(profiles, "parent")).toThrow(/extends missing profile "missing"/i);
    expect(() => resolveProfile(profiles, "parent")).toThrow(/parent -> missing/i);
  });

  it("applyProfileFilter uses resolved profile", async () => {
    const profiles = {
      base: { include: ["base-mcp", "base-agent", "base-skill"] },
      child: { extends: "base", include: ["child-mcp", "child-agent"] },
    };

    const resources = {
      mcps: {
        "child-mcp": { command: "child" },
        "base-mcp": { command: "base" },
      },
      agents: {
        "child-agent": { name: "child", prompt: "child" },
        "base-agent": { name: "base", prompt: "base" },
      },
      skills: {
        "base-skill": { name: "base", content: "base" },
      },
    };

    const resolved = resolveProfile(profiles, "child");
    const filtered = await applyProfileFilter(resources, resolved);

    expect(filtered.mcps["child-mcp"]).toBeDefined();
    expect(filtered.mcps["base-mcp"]).toBeUndefined();
    expect(filtered.agents["child-agent"]).toBeDefined();
    expect(filtered.agents["base-agent"]).toBeUndefined();
    expect(filtered.skills["base-skill"]).toBeUndefined();
  });

  it("applyProfileFilter does not mutate input resources", async () => {
    const resources = {
      mcps: {
        keep: { command: "keep" },
        drop: { command: "drop" },
      },
      agents: {
        keep: { name: "Keep", prompt: "Keep" },
      },
      skills: {
        drop: { name: "Drop", content: "Drop" },
      },
    };

    const original = structuredClone(resources);
    const filtered = await applyProfileFilter(resources, { include: ["keep"] });

    expect(filtered.mcps.keep).toBeDefined();
    expect(filtered.mcps.drop).toBeUndefined();
    expect(resources).toEqual(original);
  });
});
