## 2024-04-18 - Fix Sensitive File Permission Exposure
**Vulnerability:** File backup and export commands created sensitive configuration/backup files without explicitly restricting file permissions, leaving them readable by other users on the system (defaulting to 0o644 based on umask).
**Learning:** Atomic file write utilities that use a temporary file followed by a rename (`fs.writeFile` to `fs.rename`) do not inherit target file permissions or guarantee restricted access by default. The temporary file dictates the final permissions.
**Prevention:** Explicitly pass `{ mode: 0o600 }` to `fs.writeFile` options for any data containing sensitive credentials, backups, or exports to ensure owner-only access.
