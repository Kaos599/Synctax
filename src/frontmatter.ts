import yaml from "js-yaml";

export interface FrontmatterResult<T = Record<string, unknown>> {
  data: T;
  content: string;
}

// JSON_SCHEMA: only JSON-compatible types (strings, numbers, booleans, arrays, objects, null)
// No !!js/regexp, !!js/function, or other dangerous type tags
const SAFE_SCHEMA = yaml.JSON_SCHEMA;

/**
 * Parse YAML frontmatter from a string.
 * Expects `---\n<yaml>\n---\n<content>` format.
 * Only matches `---` at the very start of the string as frontmatter delimiters.
 * `---` appearing later in the body content is preserved as-is.
 * Returns empty data and the full string as content if no frontmatter found.
 */
export function parseFrontmatter<T = Record<string, unknown>>(raw: string): FrontmatterResult<T> {
  // Must start with --- followed by newline
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    return { data: {} as T, content: raw };
  }

  // Find the closing --- (first occurrence after the opening ---)
  const openLen = raw.startsWith("---\r\n") ? 5 : 4; // length of "---\n" or "---\r\n"

  // Handle empty frontmatter: ---\n---\n (closing --- immediately follows opening)
  if (raw.slice(openLen).startsWith("---\n") || raw.slice(openLen).startsWith("---\r\n")) {
    const closingLen = raw.slice(openLen).startsWith("---\r\n") ? 5 : 4;
    return { data: {} as T, content: raw.slice(openLen + closingLen).trim() };
  }

  const closeIdx = raw.indexOf("\n---\n", openLen);
  const closeIdxCR = raw.indexOf("\r\n---\r\n", openLen);

  let yamlBlock: string;
  let bodyStart: number;

  if (closeIdxCR !== -1 && (closeIdx === -1 || closeIdxCR < closeIdx)) {
    // Windows line endings
    yamlBlock = raw.slice(openLen, closeIdxCR);
    bodyStart = closeIdxCR + 7; // length of "\r\n---\r\n"
  } else if (closeIdx !== -1) {
    yamlBlock = raw.slice(openLen, closeIdx);
    bodyStart = closeIdx + 5; // length of "\n---\n"
  } else {
    // No closing --- found, or --- is at EOF without trailing newline
    const eofClose = raw.indexOf("\n---", openLen);
    if (eofClose !== -1 && (eofClose + 4 === raw.length || raw[eofClose + 4] === "\r")) {
      yamlBlock = raw.slice(openLen, eofClose);
      bodyStart = raw.length;
    } else {
    return { data: {} as T, content: raw };
    }
  }

  if (yamlBlock.trim() === "") {
    return { data: {} as T, content: raw.slice(bodyStart).trim() };
  }

  const parsed = yaml.load(yamlBlock, { schema: SAFE_SCHEMA });
  const data = (parsed && typeof parsed === "object" ? parsed : {}) as T;
  const content = raw.slice(bodyStart).trim();
  return { data, content };
}

/**
 * Serialize data and content into YAML frontmatter format.
 * Produces `---\n<yaml>\n---\n\n<content>`.
 * Omits frontmatter block entirely if data is empty.
 */
export function serializeFrontmatter(data: Record<string, unknown>, content: string): string {
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
  );
  if (Object.keys(filtered).length === 0) return content;
  const yamlStr = yaml.dump(filtered, { lineWidth: -1, noRefs: true, sortKeys: true, schema: SAFE_SCHEMA }).trim();
  return `---\n${yamlStr}\n---\n\n${content}`;
}
