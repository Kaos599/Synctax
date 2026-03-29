## 2024-03-29 - [Fix] Path Traversal in Configuration Adapters
**Vulnerability:** Found Path Traversal vulnerability when saving files in Configuration Adapters. Keys for agents and skills were mapped directly to file paths using `path.join`, permitting the writing of arbitrary paths inside system configs using a payload like `../../bad_file.md`.
**Learning:** We need to explicitly sanitize user-provided keys, strings and any dynamically constructed paths when storing data on the local file system.
**Prevention:** Using `path.basename(key)` will strip off any path information (`/`, `..`) leaving just the file name, effectively mitigating the path traversal vulnerability.
