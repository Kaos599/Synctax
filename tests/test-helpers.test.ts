import { describe, expect, it } from "vitest";
import { expectHas } from "./test-helpers.js";

describe("test-helpers", () => {
  it("expectHas throws when key is missing", () => {
    const record: Record<string, { name: string }> = {};
    expect(() => expectHas(record, "missing")).toThrow();
  });

  it("expectHas throws when key value is null", () => {
    const record = { nullable: null as unknown as { name: string } } as Record<string, { name: string }>;
    expect(() => expectHas(record, "nullable")).toThrow();
  });
});
