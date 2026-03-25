## 2024-05-24 - [infoCommand I/O Bottleneck]
**Learning:** Checking installed adapters sequentially blocks execution unnecessarily because each check requires disk I/O.
**Action:** Always use `Promise.all` alongside array mappings for concurrent disk I/O when processing multiple items that don't depend on each other.