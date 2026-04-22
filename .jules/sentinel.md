## 2025-04-22 - Predictable Temporary File Generation
**Vulnerability:** Predictable temporary files were being created using `Math.random().toString(36)` and `Math.random().toString(16)` when writing configuration or backup files atomically (`atomicWriteFile` and `writeFileAtomic`).
**Learning:** `Math.random()` provides weak entropy and predictable outputs, which attackers can exploit to predict temporary file paths, potentially leading to local file collisions, race conditions, or path prediction attacks.
**Prevention:** For any random bytes or temporary unique IDs needed in security or file contexts, rely solely on standard cryptographic primitives like `crypto.randomBytes(N).toString('hex')` or `crypto.randomUUID()`.
