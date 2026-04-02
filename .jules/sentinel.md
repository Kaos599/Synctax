## 2025-04-02 - Path Traversal in Adapter Writers
**Vulnerability:** Agent and Skill keys in configuration adapters were directly used in `path.join` to write files to disk, allowing a path traversal vulnerability. A malicious key like `../../../../etc/passwd` could lead to arbitrary file writes.
**Learning:** Keys coming from configurations (which might be user-controlled or imported from third-party sources) should never be trusted as safe filenames.
**Prevention:** Always sanitize object keys representing filenames using `path.basename(key)` or a dedicated validation function before using them in file system operations.
