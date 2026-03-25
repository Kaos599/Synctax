import { describe, it, expect } from "vitest";
import { semantic, symbols, brand, tableHeader } from "../../src/ui/colors.js";

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}

describe("UI Colors", () => {
  it("semantic colors are functions", () => {
    expect(typeof semantic.success).toBe("function");
    expect(typeof semantic.error).toBe("function");
    expect(typeof semantic.warning).toBe("function");
    expect(typeof semantic.info).toBe("function");
    expect(typeof semantic.muted).toBe("function");
    expect(typeof semantic.label).toBe("function");
  });

  it("symbols are strings", () => {
    expect(symbols.success).toBe("✓");
    expect(symbols.error).toBe("✗");
    expect(symbols.warning).toBe("⚠");
    expect(symbols.info).toBe("○");
    expect(symbols.arrow).toBe("→");
  });

  it("symbols fall back to ASCII when SYNCTAX_ASCII is set", () => {
    withEnv("SYNCTAX_ASCII", "1", () => {
      expect(symbols.success).toBe("+");
      expect(symbols.error).toBe("x");
      expect(symbols.warning).toBe("!");
      expect(symbols.info).toBe("o");
      expect(symbols.arrow).toBe("->");
    });
  });

  it("brand colors produce output", () => {
    expect(brand.primary("test")).toContain("test");
    expect(brand.accent("test")).toContain("test");
  });

  it("tableHeader colors produce output", () => {
    expect(tableHeader.col1("Client")).toContain("Client");
    expect(tableHeader.col5("Skills")).toContain("Skills");
  });
});
