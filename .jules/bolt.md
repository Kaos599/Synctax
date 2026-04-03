## 2024-05-24 - Parallelizing Adapter I/O Operations
**Learning:** Sequential file system and adapter I/O operations (e.g., config reads/writes, adapter detections) in a `for...of` loop create a significant architectural bottleneck in CLI execution speed. Since these operations across different adapters are independent, waiting for one to finish before starting the next wastes time.
**Action:** Always parallelize independent adapter I/O operations using `Promise.all` instead of sequential `await` loops to drastically improve performance.
