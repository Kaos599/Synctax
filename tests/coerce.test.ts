import { describe, expect, it } from "vitest";
import { toArray, toBool, toNum, toRecord, toStr } from "../src/coerce.js";

describe("coerce", () => {
  describe("toArray", () => {
    it("should return string array when given string array", () => {
      expect(toArray(["a", "b"])).toEqual(["a", "b"]);
    });

    it("should filter out non-strings when given mixed array", () => {
      expect(toArray(["a", 1, "b", true])).toEqual(["a", "b"]);
    });

    it("should split string on commas and trim whitespace", () => {
      expect(toArray("a, b , c")).toEqual(["a", "b", "c"]);
    });

    it("should filter out empty strings after splitting", () => {
      expect(toArray("a,,b, ")).toEqual(["a", "b"]);
    });

    it("should return undefined for empty string", () => {
      expect(toArray("")).toBeUndefined();
    });

    it("should return undefined for invalid types", () => {
      expect(toArray(123)).toBeUndefined();
      expect(toArray(true)).toBeUndefined();
      expect(toArray({})).toBeUndefined();
      expect(toArray(null)).toBeUndefined();
    });
  });

  describe("toBool", () => {
    it("should return boolean when given boolean", () => {
      expect(toBool(true)).toBe(true);
      expect(toBool(false)).toBe(false);
    });

    it("should parse 'true' or 'false' case-insensitively", () => {
      expect(toBool("true")).toBe(true);
      expect(toBool("TRUE")).toBe(true);
      expect(toBool("false")).toBe(false);
      expect(toBool("FaLsE")).toBe(false);
    });

    it("should parse 1/0 as boolean", () => {
      expect(toBool(1)).toBe(true);
      expect(toBool(0)).toBe(false);
    });

    it("should return undefined for invalid types", () => {
      expect(toBool("yes")).toBeUndefined();
      expect(toBool(2)).toBeUndefined();
      expect(toBool([])).toBeUndefined();
      expect(toBool({})).toBeUndefined();
      expect(toBool(null)).toBeUndefined();
    });
  });

  describe("toNum", () => {
    it("should return number when given finite number", () => {
      expect(toNum(123)).toBe(123);
      expect(toNum(-12.3)).toBe(-12.3);
    });

    it("should filter out Infinity and NaN", () => {
      expect(toNum(Infinity)).toBeUndefined();
      expect(toNum(-Infinity)).toBeUndefined();
      expect(toNum(NaN)).toBeUndefined();
    });

    it("should parse valid numeric string", () => {
      expect(toNum("123")).toBe(123);
      expect(toNum("-12.3")).toBe(-12.3);
    });

    it("should return undefined for unparseable strings", () => {
      expect(toNum("abc")).toBeUndefined();
      expect(toNum("123a")).toBeUndefined();
    });

    it("should return undefined for invalid types", () => {
      expect(toNum(true)).toBeUndefined();
      expect(toNum([])).toBeUndefined();
      expect(toNum({})).toBeUndefined();
      expect(toNum(null)).toBeUndefined();
    });
  });

  describe("toStr", () => {
    it("should return string when given string", () => {
      expect(toStr("abc")).toBe("abc");
      expect(toStr("")).toBe("");
    });

    it("should convert truthy or falsy non-null values to string", () => {
      expect(toStr(123)).toBe("123");
      expect(toStr(0)).toBe("0");
      expect(toStr(true)).toBe("true");
      expect(toStr(false)).toBe("false");
    });

    it("should return undefined for null and undefined", () => {
      expect(toStr(null)).toBeUndefined();
      expect(toStr(undefined)).toBeUndefined();
    });
  });

  describe("toRecord", () => {
    it("should return plain object when given plain object", () => {
      expect(toRecord({ a: 1 })).toEqual({ a: 1 });
      expect(toRecord({})).toEqual({});
    });

    it("should filter out arrays", () => {
      expect(toRecord([])).toBeUndefined();
      expect(toRecord([1, 2])).toBeUndefined();
    });

    it("should return undefined for primitives", () => {
      expect(toRecord(123)).toBeUndefined();
      expect(toRecord("abc")).toBeUndefined();
      expect(toRecord(true)).toBeUndefined();
    });

    it("should return undefined for null and undefined", () => {
      expect(toRecord(null)).toBeUndefined();
      expect(toRecord(undefined)).toBeUndefined();
    });
  });
});
