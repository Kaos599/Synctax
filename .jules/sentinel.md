## 2024-04-04 - Path Traversal Vulnerability in Configuration Adapters
**Vulnerability:** User-provided config keys were being directly interpolated into file paths in the `claude` and `cursor` adapters (e.g. `path.join(this.userAgentsDir, `${key}.md`)`). This could allow path traversal attacks where malicious keys write files outside the intended directories.
**Learning:** Keys read from external configs should never be trusted as safe path segments. They can contain sequences like `../`.
**Prevention:** Always sanitize dynamically constructed file system paths from user data using `path.basename()` before writing to disk.
