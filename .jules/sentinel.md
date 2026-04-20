## 2023-10-27 - Local Data Exposure via Temporary File Permissions
**Vulnerability:** Sensitive files like backup archives (`src/backup/archive.ts`) and configuration restorations (`src/commands/io.ts`) were being written using a temporary file with default permissions (e.g. `0o644`), which exposes sensitive data to local users before the file is renamed.
**Learning:** Atomic file writes (`fs.writeFile` to a temp file, followed by `fs.rename`) do not inherit target file permissions or guarantee restricted access by default. The temporary file dictates the final permissions.
**Prevention:** Explicitly pass `{ mode: 0o600 }` to `fs.writeFile` when creating the temporary file for sensitive data to ensure only the owner has read/write access.
