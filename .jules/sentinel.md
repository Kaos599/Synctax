## 2025-04-16 - File Permissions During Atomic Renames
**Vulnerability:** Backup archives and restored configuration files were created with default file permissions before being atomically renamed into place. This meant sensitive information could potentially be read by other users on the system during or after creation.
**Learning:** Atomic write utilities (`fs.writeFile` to a temp file, followed by `fs.rename`) do not preserve the permissions of an existing target file or guarantee restrictive permissions by default. The temporary file dictates the final file's permissions.
**Prevention:** When creating atomic write utilities for sensitive files, explicitly pass `{ mode: 0o600 }` to the initial `fs.writeFile` call on the temporary file.
