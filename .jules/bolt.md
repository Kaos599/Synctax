## 2025-04-26 - Single-Pass Aggregation
**Learning:** In `src/backup/archive.ts`, there are multiple `filter().length` calls on the `clientResults` array which creates multiple intermediate array allocations and causes multiple passes over the array.
**Action:** Single-pass `.reduce()` should be preferred over multiple `.filter().length` calls when aggregating status counts from result arrays to achieve O(N) complexity and minimize array allocations.
