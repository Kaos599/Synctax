## 2023-10-27 - Aggregating Status Totals efficiently
**Learning:** In the CLI operations, there's a pattern of using multiple `.filter().length` calls over a result array to aggregate totals, such as `success`, `partial`, `skipped`, and `failed`. This triggers an O(4N) execution and generates multiple intermediate arrays.
**Action:** When refactoring multiple `.filter().length` count calculations, use a single `.reduce()` pass for an O(N) evaluation that prevents unnecessary garbage collection and array allocations.
