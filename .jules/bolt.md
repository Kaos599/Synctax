
## 2024-05-09 - O(N) over multiple O(N) array passes
**Learning:** Found a sequence of multiple `filter(…).length` iterations in `src/backup/archive.ts` summing up client results. These arrays might get big. Switched it to a single-pass `reduce` iterator.
**Action:** Use a single `reduce` pass to compute multiple related totals instead of sequential filtering.
