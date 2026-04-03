## 2025-05-15 - Parallel I/O Optimization
**Learning:** Sequential asynchronous I/O across multiple clients caused noticeable command delays.
**Action:** Replaced sequential `for...await` loops with `Promise.all` arrays for operations like adapter reads, detects, and writes.
