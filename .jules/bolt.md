## 2024-04-03 - Promise.all to bypass O(N) sequential file I/O bottleneck
**Learning:** Sequential adapter detections and read/write loops naturally create an O(N) performance bottleneck in CLI architectures managing multiple concurrent sync targets or data sources.
**Action:** Always wrap independent adapter read, detect, or write operations in mapped async arrays and execute them concurrently via `Promise.all` to significantly enhance CLI performance, particularly when traversing several plugins or configuration endpoints.
