## 2025-02-15 - Unblocking CLI Execution with Parallel I/O
**Learning:** Sequential execution of configuration reads, adapter detections, and writes significantly blocks CLI execution time.
**Action:** Replace sequential `await` loops for these independent operations with `Promise.all` (or `Promise.allSettled`) to drastically improve CLI execution speed.