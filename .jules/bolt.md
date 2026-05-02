## 2024-05-02 - Sequential fs.unlink bottleneck in Backup Pruning
**Learning:** Found that `pruneBackups` in `src/config.ts` was deleting old backup files sequentially using a `for...of` loop with `await fs.unlink()`. In NodeJS, sequential file system operations scale poorly with large counts.
**Action:** Always map arrays of independent async I/O operations (like file deletions) to Promises and execute them concurrently via `Promise.all` while ensuring individual errors are caught within the `map` callback so failures don't halt the entire process.
