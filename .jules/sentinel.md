## 2024-05-18 - Path Traversal Vulnerability in Configuration Adapters

**Vulnerability:** Dynamically generated configuration file names inside adapters (`src/adapters/claude.ts` and `src/adapters/cursor.ts`) were vulnerable to path traversal. Keys like `agentName` or `skillName` derived from potentially malicious configuration objects were concatenated directly into paths: `await fs.writeFile(path.join(this.userAgentsDir, \`\${key}.md\`), ...)`. This could allow writing `.md` files outside of the intended directories if a key included directory traversal characters (e.g. `../../../`).

**Learning:** When generating files based on object keys or other configuration values that originate from a potentially untrusted config source, never trust them as safe filesystem components. A user could configure an AI agent with malicious tool outputs or configs that result in arbitrary file writes.

**Prevention:** Always sanitize any user-provided or dynamic key before using it in path construction by using `path.basename(key)` or applying explicit character whitelist filtering.
