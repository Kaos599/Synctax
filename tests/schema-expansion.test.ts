import { describe, it, expect } from "vitest";
import {
  McpServerSchema,
  AgentSchema,
  SkillSchema,
  PermissionsSchema,
  ConfigSchema,
} from "../src/types.js";

describe("Schema backward compatibility", () => {
  it("McpServerSchema parses v1 format without new fields", () => {
    const v1 = { command: "npx", args: ["-y", "server"], env: { KEY: "val" } };
    const result = McpServerSchema.parse(v1);
    expect(result.command).toBe("npx");
    expect(result.url).toBeUndefined();
    expect(result.headers).toBeUndefined();
    expect(result.cwd).toBeUndefined();
    expect(result.timeout).toBeUndefined();
    expect(result.disabled).toBeUndefined();
  });

  it("McpServerSchema accepts new v2 fields", () => {
    const v2 = {
      command: "npx",
      url: "https://mcp.example.com",
      headers: { Authorization: "Bearer token" },
      cwd: "/tmp",
      timeout: 5000,
      disabled: false,
    };
    const result = McpServerSchema.parse(v2);
    expect(result.url).toBe("https://mcp.example.com");
    expect(result.headers).toEqual({ Authorization: "Bearer token" });
    expect(result.timeout).toBe(5000);
    expect(result.disabled).toBe(false);
  });

  it("AgentSchema parses v1 format without new fields", () => {
    const v1 = { name: "Agent", prompt: "Do stuff", model: "claude-sonnet-4-20250514" };
    const result = AgentSchema.parse(v1);
    expect(result.name).toBe("Agent");
    expect(result.disallowedTools).toBeUndefined();
    expect(result.maxTurns).toBeUndefined();
    expect(result.background).toBeUndefined();
  });

  it("AgentSchema accepts new v2 fields", () => {
    const v2 = {
      name: "Agent",
      prompt: "Do stuff",
      tools: ["Read", "Write"],
      disallowedTools: ["Bash"],
      permissionMode: "bypassPermissions",
      maxTurns: 10,
      mcpServers: ["postgres", "redis"],
      hooks: { preToolUse: "echo hi" },
      memory: ["memory.md"],
      background: true,
      effort: "high",
      isolation: true,
      userInvocable: false,
    };
    const result = AgentSchema.parse(v2);
    expect(result.disallowedTools).toEqual(["Bash"]);
    expect(result.maxTurns).toBe(10);
    expect(result.background).toBe(true);
    expect(result.isolation).toBe(true);
  });

  it("AgentSchema accepts mcpServers as object", () => {
    const v2 = {
      name: "Agent",
      prompt: "Prompt",
      mcpServers: { postgres: { command: "npx" } },
    };
    const result = AgentSchema.parse(v2);
    expect(result.mcpServers).toEqual({ postgres: { command: "npx" } });
  });

  it("SkillSchema parses v1 format without new fields", () => {
    const v1 = { name: "Skill", content: "Do this", trigger: "/skill" };
    const result = SkillSchema.parse(v1);
    expect(result.argumentHint).toBeUndefined();
    expect(result.userInvocable).toBeUndefined();
  });

  it("SkillSchema accepts new v2 fields", () => {
    const v2 = {
      name: "Skill",
      content: "Do this",
      argumentHint: "<file>",
      disableModelInvocation: true,
      userInvocable: true,
      allowedTools: ["Read", "Grep"],
      model: "claude-sonnet-4-20250514",
      effort: "medium",
      context: ["file1.ts", "file2.ts"],
      agent: "reviewer",
      hooks: { onActivate: "echo activated" },
    };
    const result = SkillSchema.parse(v2);
    expect(result.argumentHint).toBe("<file>");
    expect(result.allowedTools).toEqual(["Read", "Grep"]);
    expect(result.userInvocable).toBe(true);
  });

  it("PermissionsSchema parses v1 format (legacy fields)", () => {
    const v1 = {
      allowedPaths: ["/home"],
      deniedPaths: ["/root"],
      allowedCommands: ["npm"],
      deniedCommands: ["rm"],
      networkAllow: true,
    };
    const result = PermissionsSchema.parse(v1);
    expect(result.allowedPaths).toEqual(["/home"]);
    expect(result.allow).toEqual([]);
    expect(result.deny).toEqual([]);
    expect(result.ask).toEqual([]);
    expect(result.allowedUrls).toEqual([]);
  });

  it("PermissionsSchema accepts v2 unified permissions", () => {
    const v2 = {
      allow: ["Bash(npm run *)", "Read(~/docs/**)"],
      deny: ["Bash(curl *)", "Read(.env)"],
      ask: ["Bash(git push *)"],
      allowedUrls: ["https://api.example.com"],
      deniedUrls: ["http://evil.com"],
      trustedFolders: ["/Users/me/projects"],
    };
    const result = PermissionsSchema.parse(v2);
    expect(result.allow).toEqual(["Bash(npm run *)", "Read(~/docs/**)"]);
    expect(result.deny).toEqual(["Bash(curl *)", "Read(.env)"]);
    expect(result.ask).toEqual(["Bash(git push *)"]);
    expect(result.allowedUrls).toEqual(["https://api.example.com"]);
    expect(result.trustedFolders).toEqual(["/Users/me/projects"]);
    // Legacy fields default to empty
    expect(result.allowedPaths).toEqual([]);
    expect(result.networkAllow).toBe(false);
  });

  it("Full ConfigSchema parses v1 config unchanged", () => {
    const v1Config = {
      version: 1,
      theme: "rebel",
      activeProfile: "default",
      clients: { claude: { enabled: true } },
      profiles: { default: {} },
      resources: {
        mcps: { postgres: { command: "npx", args: ["-y", "server"] } },
        agents: { coder: { name: "Coder", prompt: "Code stuff" } },
        skills: { review: { name: "Review", content: "Review code" } },
        permissions: { allowedPaths: ["/home"], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false },
      },
    };
    const result = ConfigSchema.parse(v1Config);
    expect(result.version).toBe(1);
    expect(result.resources.mcps.postgres!.command).toBe("npx");
    expect(result.resources.agents.coder!.name).toBe("Coder");
    // New fields should be absent/undefined
    expect(result.resources.mcps.postgres!.url).toBeUndefined();
    expect(result.resources.agents.coder!.disallowedTools).toBeUndefined();
    // New permissions fields default to empty
    expect(result.resources.permissions.allow).toEqual([]);
  });
});
