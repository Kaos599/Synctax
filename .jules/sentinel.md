## 2025-02-15 - [Test Suite Failure due to resolves.not.toThrow]
**Vulnerability:** Vitest/Jest tests failing when trying to assert `resolves.not.toThrow()` on asynchronous functions returning `Promise<void>`.
**Learning:** `resolves` unwraps the Promise's resolved value (which is `undefined`), and passes it to `toThrow()`. Since `toThrow()` expects a function, not `undefined`, the test will fail with a `TypeError`.
**Prevention:** Change to `.resolves.toBeUndefined()` properly asserts that the asynchronous operation completes successfully without throwing errors.
