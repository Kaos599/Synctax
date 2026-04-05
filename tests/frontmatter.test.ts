import { describe, it, expect } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../src/frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses simple key-value frontmatter", () => {
    const input = `---
name: My Agent
description: A test agent
model: claude-sonnet-4-20250514
---

This is the prompt content.`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({
      name: "My Agent",
      description: "A test agent",
      model: "claude-sonnet-4-20250514",
    });
    expect(result.content).toBe("This is the prompt content.");
  });

  it("parses arrays in frontmatter", () => {
    const input = `---
name: My Agent
tools:
  - Read
  - Write
  - Bash
---

Prompt here.`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({
      name: "My Agent",
      tools: ["Read", "Write", "Bash"],
    });
    expect(result.content).toBe("Prompt here.");
  });

  it("parses inline arrays in frontmatter", () => {
    const input = `---
name: My Agent
tools: [Read, Write, Bash]
---

Prompt here.`;
    const result = parseFrontmatter(input);
    expect((result.data as any).tools).toEqual(["Read", "Write", "Bash"]);
  });

  it("parses nested objects in frontmatter", () => {
    const input = `---
name: My Agent
mcpServers:
  postgres:
    command: npx
  redis:
    command: bun
---

Content.`;
    const result = parseFrontmatter(input);
    expect((result.data as any).mcpServers).toEqual({
      postgres: { command: "npx" },
      redis: { command: "bun" },
    });
  });

  it("parses boolean and numeric values", () => {
    const input = `---
name: Agent
background: true
maxTurns: 10
userInvocable: false
---

Content.`;
    const result = parseFrontmatter(input);
    expect((result.data as any).background).toBe(true);
    expect((result.data as any).maxTurns).toBe(10);
    expect((result.data as any).userInvocable).toBe(false);
  });

  it("returns empty data and full content when no frontmatter", () => {
    const input = "Just plain content with no frontmatter.";
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.content).toBe("Just plain content with no frontmatter.");
  });

  it("preserves leading and trailing whitespace when no frontmatter found", () => {
    const input = "\n  Content with leading whitespace.  \n";
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.content).toBe(input);
  });

  it("handles empty frontmatter block", () => {
    const input = `---
---

Content after empty frontmatter.`;
    const result = parseFrontmatter(input);
    // yaml.load of empty string returns undefined, which we normalize to {}
    expect(result.data).toEqual({});
    expect(result.content).toBe("Content after empty frontmatter.");
  });

  it("handles multiline content after frontmatter", () => {
    const input = `---
name: Agent
---

Line 1.

Line 2.

Line 3.`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({ name: "Agent" });
    expect(result.content).toBe("Line 1.\n\nLine 2.\n\nLine 3.");
  });

  it("handles Windows-style line endings", () => {
    const input = "---\r\nname: Agent\r\n---\r\nContent here.";
    const result = parseFrontmatter(input);
    expect((result.data as any).name).toBe("Agent");
    expect(result.content).toBe("Content here.");
  });
});

describe("serializeFrontmatter", () => {
  it("serializes data and content into frontmatter format", () => {
    const data = { name: "My Agent", model: "claude-sonnet-4-20250514" };
    const content = "This is the prompt.";
    const result = serializeFrontmatter(data, content);
    expect(result).toContain("---\n");
    expect(result).toContain("name: My Agent");
    expect(result).toContain("model: claude-sonnet-4-20250514");
    expect(result).toContain("---\n\nThis is the prompt.");
  });

  it("serializes arrays correctly", () => {
    const data = { name: "Agent", tools: ["Read", "Write"] };
    const result = serializeFrontmatter(data, "Content.");
    expect(result).toContain("tools:");
    expect(result).toContain("Content.");
  });

  it("omits frontmatter when data is empty", () => {
    const result = serializeFrontmatter({}, "Just content.");
    expect(result).toBe("Just content.");
    expect(result).not.toContain("---");
  });

  it("omits undefined and null values", () => {
    const data = { name: "Agent", description: undefined, model: null } as any;
    const result = serializeFrontmatter(data, "Content.");
    expect(result).toContain("name: Agent");
    expect(result).not.toContain("description");
    expect(result).not.toContain("model");
  });

  it("round-trips through parse and serialize", () => {
    const original = {
      name: "Test Agent",
      tools: ["Read", "Write", "Bash"],
      background: true,
      maxTurns: 5,
    };
    const content = "This is the prompt content.";
    const serialized = serializeFrontmatter(original, content);
    const parsed = parseFrontmatter(serialized);
    expect(parsed.data).toEqual(original);
    expect(parsed.content).toBe(content);
  });

  it("round-trips content that contains --- (horizontal rule)", () => {
    const data = { name: "Agent" };
    const content = "Before the rule.\n\n---\n\nAfter the rule.";
    const serialized = serializeFrontmatter(data, content);
    const parsed = parseFrontmatter(serialized);
    expect(parsed.data).toEqual(data);
    expect(parsed.content).toBe(content);
  });
});
