## 2025-03-01 - [Predictable Temp Filenames]
**Vulnerability:** Temporary file creation in atomic write utilities (`src/fs-utils.ts`, `src/backup/archive.ts`) used predictable filename generation via `Math.random()`.
**Learning:** `Math.random()` provides pseudorandomness which is predictable. In environments where local file systems are shared, predicting temporary file paths could allow for symlink attacks or data leakage when files are written or restored.
**Prevention:** Always use cryptographically secure random number generators like `crypto.randomBytes(8).toString('hex')` or `crypto.randomUUID()` when generating temporary file paths or suffixes.
