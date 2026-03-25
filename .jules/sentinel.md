## 2024-05-18 - Path Traversal in Configuration Adapters
**Vulnerability:** User-provided agent/skill keys were concatenated directly into file paths (`path.join(dir, key + ".md")`), permitting potential directory traversal if malicious payload keys like `../../../etc/passwd` were synchronized from remote profiles or altered configs.
**Learning:** Even though keys are intended as simple alphanumeric identifiers, unvalidated user input used in file system operations remains an architectural vulnerability across synchronization systems.
**Prevention:** Always sanitize dynamic inputs acting as filenames by extracting only the filename component (e.g., using `path.basename(key)`) before constructing file paths.
