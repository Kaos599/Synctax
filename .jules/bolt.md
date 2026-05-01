## 2024-05-18 - Parallel adapter detection in initCommand
**Learning:** `initCommand` sequentially calls `adapter.detect()` for every registered adapter inside a `for...of` loop. In I/O-heavy operations (e.g., checking paths for config files across many adapters), this creates a significant performance bottleneck where the total initialization time grows linearly with the number of adapters.
**Action:** Always parallelize independent adapter I/O operations (like `detect()`) using `Promise.all` and iterate over the results instead.
