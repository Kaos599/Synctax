## 2024-05-18 - [Parallelizing Adapter I/O]
**Learning:** I/O operations and adapter detections across multiple enabled clients in the CLI create significant sequential bottlenecks during status, info, and sync commands.
**Action:** Use Promise.all to map and execute asynchronous file system operations and detections concurrently across adapters to drastically improve overall CLI execution speed.
