## 2024-05-18 - Parallelize Independent File System and Adapter I/O

**Learning:** When executing I/O operations across multiple configurable adapters (like reading `.mcps` or `.agents`), doing them sequentially in a `for...of` loop is a major codebase-specific performance bottleneck because each adapter's reads are independent file system lookups. Also, using `Promise.all` directly with mapping requires careful error handling.

**Action:** To optimize CLI commands mapping over adapters, always parallelize using `Promise.all`. However, to prevent one failing adapter from crashing the entire operation, wrap the adapter call inside a `try/catch` within the `map`, and return a discriminated union object (`{ success: true, data }` or `{ success: false, error }`). This drastically improves speed while maintaining robust error handling.
