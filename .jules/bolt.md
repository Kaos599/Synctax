
## 2023-10-25 - [Single-Pass Array Reductions]
**Learning:** Multiple array filters combined with length properties cause unnecessary temporary object allocations and iterative O(N) penalties, specifically during aggregation over CLI execution records or backup results.
**Action:** Use a single-pass `reduce` over result arrays to compute totals (e.g., status counts) safely, preventing heap fragmentation in heavy CLI sync/backup processes.
