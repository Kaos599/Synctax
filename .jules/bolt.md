## 2024-05-18 - Parallelizing Adapter I/O in the CLI

**Learning:** When dealing with multiple AI client adapters that each perform independent file system access (like checking for directories or parsing settings via `detect` and `read` methods), running them sequentially creates a noticeable bottleneck. These operations are independent and safe to parallelize.

**Action:** Whenever iterating over configuration adapters to fetch statuses, detect installations, or retrieve configurations in a CLI command (e.g. `statusCommand`, `infoCommand`, `doctorCommand`, `initCommand`), use `Promise.all` with `map` instead of a sequential `for...of` loop with `await`. This drastically reduces the total execution time of these operations as they now resolve concurrently.
