## 2026-04-17 - [Replace repeated filter.length with reduce]
**Learning:** We had redundant O(N) array iterations when trying to aggregate results into counts using .filter(..).length for each status. This is expensive and does unnecessary array allocations.
**Action:** Replaced 4 iterations of .filter(...).length with a single .reduce pass that calculates all the counts in O(N). Always prefer one-pass aggregations for arrays when compiling multiple totals.
