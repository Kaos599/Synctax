## 2024-05-19 - Replace O(M*N) array aggregations with single O(N) reduce pass
**Learning:** In command results formatting (like in backup archive mapping and sync totals), using multiple `.filter().length` chains to count different statuses iterates the array multiple times. This introduces unnecessary overhead (O(M*N) where M is the number of statuses).
**Action:** Always prefer a single `.reduce()` or `for...of` loop when tallying multiple conditions in a collection. This performs all calculations in a single O(N) pass.
