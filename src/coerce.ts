/**
 * Type coercion helpers for adapter read paths.
 *
 * YAML frontmatter and hand-edited JSON often store arrays as comma-separated
 * strings, booleans as strings, etc. These helpers normalize values before
 * they reach the Zod schema so that validation doesn't fail on malformed input.
 */

/**
 * Convert any value to a string array.
 * - Array → returned as-is
 * - String → split on commas, trim, filter empty
 * - Anything else → undefined
 */
export function toArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") {
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
}

/**
 * Convert any value to a boolean.
 * - Boolean → returned as-is
 * - String "true"/"false" (case-insensitive) → boolean
 * - Number 0/1 → boolean
 * - Anything else → undefined
 */
export function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return undefined;
}

/**
 * Convert any value to a number.
 * - Number → returned as-is
 * - String that parses as a finite number → number
 * - Anything else → undefined
 */
export function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Convert any value to a string.
 * - String → returned as-is
 * - Anything truthy → String(v)
 * - Anything else → undefined
 */
export function toStr(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v != null) return String(v);
  return undefined;
}

/**
 * Convert any value to a record (object).
 * - Plain object → returned as-is
 * - Anything else → undefined
 */
export function toRecord(v: unknown): Record<string, unknown> | undefined {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return undefined;
}
