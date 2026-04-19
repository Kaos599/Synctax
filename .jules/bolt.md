## 2024-05-18 - Missing global mocks when running `bun test`
**Learning:** `bun test` fails when vitest's global properties (like `vi.useFakeTimers()`) are invoked if `vi` isn't fully set up in the expected environment, causing tests to crash.
**Action:** Use `pnpm test` as it wraps the test environment properly with Vitest setup or manually mock things when writing unit tests. Memory rules confirm that if `bun test` fails due to `vitest globals`, `pnpm test` might work.
## 2024-05-18 - Single-pass `.reduce()` for result aggregation
**Learning:** Multiple `.filter().length` calls iterate over arrays repeatedly resulting in O(k*N) complexity and multiple temporary array allocations. Using a single `.reduce()` is much faster (measurably ~60-70% faster in a large array) for status count/tallying, keeping it at O(N) complexity with minimal memory allocation.
**Action:** Always prefer a single `.reduce()` pass when aggregating result object fields (e.g. status) rather than using consecutive `.filter().length` queries.
