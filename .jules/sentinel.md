
## 2025-04-28 - [MEDIUM] Predictable Temporary Filenames
**Vulnerability:** The application was using `Math.random().toString(36).slice(2)` and `Math.random().toString(16).slice(2)` to generate temporary filenames in `src/fs-utils.ts` and `src/backup/archive.ts` during atomic file operations.
**Learning:** `Math.random()` does not provide cryptographically secure pseudorandom number generation, making temporary file paths predictable. This can be exploited by local attackers to perform symlink attacks or file overwrite attacks by anticipating the filename.
**Prevention:** Always use a cryptographically secure random number generator (e.g. `crypto.randomBytes(8).toString('hex')`) instead of `Math.random()` when creating temporary files, security tokens, or any security-sensitive random values.
