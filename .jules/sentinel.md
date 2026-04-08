## 2024-05-24 - Secure configuration file permissions
**Vulnerability:** The main configuration file `~/.synctax/config.json` was written using default permissions (`0o644`), which made it readable by other users on a multi-user system. This file can contain sensitive environment variables or arguments for MCP servers.
**Learning:** Security must be applied globally to configuration files since they consolidate sensitive settings for various agents and external services.
**Prevention:** Use `atomicWriteSecure` (which writes with `0o600` permissions) instead of `atomicWriteFile` for all master configuration files (both when writing and when restoring from backup).
