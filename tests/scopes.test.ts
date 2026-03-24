import { describe, it, expect } from "vitest";
import { splitByScope, toConfigScope } from "../src/scopes.js";

describe("toConfigScope", () => {
  it("maps 'local' to 'local'", () => {
    expect(toConfigScope("local")).toBe("local");
  });

  it("maps 'project' to 'project'", () => {
    expect(toConfigScope("project")).toBe("project");
  });

  it("maps 'user' to 'user'", () => {
    expect(toConfigScope("user")).toBe("user");
  });

  it("maps 'global' to 'global'", () => {
    expect(toConfigScope("global")).toBe("global");
  });

  it("maps undefined to 'global'", () => {
    expect(toConfigScope(undefined)).toBe("global");
  });
});

describe("splitByScope", () => {
  it("splits resources into 4 buckets", () => {
    const records = {
      a: { name: "A", scope: "global" as const },
      b: { name: "B", scope: "user" as const },
      c: { name: "C", scope: "project" as const },
      d: { name: "D", scope: "local" as const },
    };
    const result = splitByScope(records);
    expect(Object.keys(result.global)).toEqual(["a"]);
    expect(Object.keys(result.user)).toEqual(["b"]);
    expect(Object.keys(result.project)).toEqual(["c"]);
    expect(Object.keys(result.local)).toEqual(["d"]);
  });

  it("defaults unscoped items to global", () => {
    const records = {
      a: { name: "A" },
      b: { name: "B", scope: undefined },
    };
    const result = splitByScope(records);
    expect(Object.keys(result.global)).toEqual(["a", "b"]);
    expect(Object.keys(result.local)).toEqual([]);
    expect(Object.keys(result.project)).toEqual([]);
    expect(Object.keys(result.user)).toEqual([]);
  });

  it("handles null/undefined records", () => {
    expect(splitByScope(null)).toEqual({ local: {}, project: {}, user: {}, global: {} });
    expect(splitByScope(undefined)).toEqual({ local: {}, project: {}, user: {}, global: {} });
  });

  it("handles empty records", () => {
    expect(splitByScope({})).toEqual({ local: {}, project: {}, user: {}, global: {} });
  });
});
