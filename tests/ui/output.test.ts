import { describe, it, expect, vi, afterEach } from "vitest";
import { format, success, error, warn, info, header, dim, dryRun, gap } from "../../src/ui/output.js";

function withUnicode(fn: () => void): void {
  const prevAscii = process.env["SYNCTAX_ASCII"];
  const prevTerm = process.env["TERM"];
  delete process.env["SYNCTAX_ASCII"];
  process.env["TERM"] = "xterm-256color";
  try {
    fn();
  } finally {
    if (prevAscii === undefined) delete process.env["SYNCTAX_ASCII"];
    else process.env["SYNCTAX_ASCII"] = prevAscii;
    if (prevTerm === undefined) delete process.env["TERM"];
    else process.env["TERM"] = prevTerm;
  }
}

describe("UI Output", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("format functions return strings", () => {
    it("format.success includes checkmark and message", () => {
      withUnicode(() => {
        const result = format.success("Synced");
        expect(result).toContain("✓");
        expect(result).toContain("Synced");
      });
    });

    it("format.error includes X mark and message", () => {
      withUnicode(() => {
        const result = format.error("Failed");
        expect(result).toContain("✗");
        expect(result).toContain("Failed");
      });
    });

    it("format.warn includes warning symbol", () => {
      withUnicode(() => {
        const result = format.warn("Careful");
        expect(result).toContain("⚠");
        expect(result).toContain("Careful");
      });
    });

    it("format.info contains message", () => {
      const result = format.info("Starting sync...");
      expect(result).toContain("Starting sync...");
    });

    it("format.dryRun prefixes with [Dry Run]", () => {
      const result = format.dryRun("Would write");
      expect(result).toContain("[Dry Run]");
      expect(result).toContain("Would write");
    });

    it("format.dim contains message", () => {
      const result = format.dim("secondary info");
      expect(result).toContain("secondary info");
    });

    it("format.success supports indent", () => {
      const noIndent = format.success("test", { indent: 0 });
      const indented = format.success("test", { indent: 2 });
      expect(indented.length).toBeGreaterThan(noIndent.length);
    });

    it("format.brandHeader includes version and profile", () => {
      const result = format.brandHeader("2.0", "work");
      expect(result).toContain("Synctax v2.0");
      expect(result).toContain("Profile: work");
    });

    it("format.brandHeader works without profile", () => {
      const result = format.brandHeader("2.0");
      expect(result).toContain("Synctax v2.0");
      expect(result).not.toContain("Profile");
    });

    it("format.summary includes elapsed and detail", () => {
      const result = format.summary("0.3s", "4/5 clients synced");
      expect(result).toContain("0.3s");
      expect(result).toContain("4/5 clients synced");
    });
  });

  describe("print functions write to console.log", () => {
    it("success() calls console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      success("test");
      expect(spy).toHaveBeenCalledOnce();
      expect(String(spy.mock.calls[0]![0])).toContain("test");
    });

    it("error() calls console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      error("test");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("gap() prints empty line", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      gap();
      expect(spy).toHaveBeenCalledWith();
    });
  });
});
