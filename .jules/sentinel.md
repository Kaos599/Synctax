## 2026-04-16 - [Secure File Permissions on Backup Archives]
**Vulnerability:** Backup archives containing sensitive configuration and memory data were created with default file permissions, exposing sensitive local data.
**Learning:** Default file creation relies on the environment's umask which may not be restrictive enough for sensitive files.
**Prevention:** Always use `mode: 0o600` when writing files that contain secrets or sensitive user data, specifically replacing `await fs.writeFile(...)` with `await fs.writeFile(..., { mode: 0o600 })`.
