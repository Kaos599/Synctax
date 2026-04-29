## 2025-02-28 - Insecure Temporary File Generation
**Vulnerability:** Use of predictable temporary filenames via `Math.random().toString(36)` and `Math.random().toString(16)` when writing sensitive sync configurations and backups.
**Learning:** `Math.random()` does not provide cryptographically secure random numbers, meaning attackers on the same machine could theoretically predict the temp file names generated during atomic writes and intercept or modify sensitive agent configurations.
**Prevention:** Always use Node's `crypto` module (`crypto.randomBytes()`) when generating unique strings for temporary files used in atomic file system operations, especially those managing credentials or sensitive config.
