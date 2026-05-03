## 2024-05-28 - [Predictable Temporary Filenames in Atomic File Writes]
**Vulnerability:** The codebase was using `Math.random().toString(36).slice(2)` to generate suffixes for temporary files during atomic file writes (`fs-utils.ts` and `archive.ts`).
**Learning:** `Math.random()` is not cryptographically secure, making temporary filenames predictable. This creates a theoretical risk for temp-file collision, predictability, or race conditions where an attacker could anticipate a temp filename and replace it before `fs.rename` happens.
**Prevention:** Always use Node's native `crypto.randomBytes()` (or `crypto.randomUUID()`) to generate random strings for sensitive operations, including temporary file paths for atomic operations.
