## 2025-02-19 - Initial Learnings

**Learning:** There are several commands in the codebase that perform parallel file-system and adapter reads/writes. In `src/commands/info.ts` and `src/commands/status.ts`, parallel I/O is used. In `src/commands/sync.ts`, there are loops that currently do sequential `await` operations when taking snapshots (`adapter.read()`) and when creating rollback snapshots, but these seem partially sequential because of the order. Let's see if there are other areas to parallelize I/O.
**Action:** Always verify `Promise.all` usages handles errors properly by returning the adapter context.

## 2025-02-19 - Parallelized I/O Operations in Sync Command
**Learning:** Discovered that sequential loops calling async adapter reads and writes in `sync.ts` bottleneck the CLI execution speed when interacting with multiple adapters.
**Action:** Ensure `Promise.all` usages handles errors properly by returning the adapter context alongside the result/error (e.g. `{ adapter, success: false, error: e.message }`) to prevent unhandled rejections and allow proper logging per adapter, rather than relying on sequential loops.
