
## 2024-05-18 - I/O Operations parallelization

**Learning:** When performing file operations across multiple domains or target directories sequentially in `for...of` loops, execution time scales linearly.
**Action:** Use `Promise.all` combined with `.map(async () => {})` block to dispatch I/O promises concurrently. It's crucial to return any potential errors as object properties (e.g. `{ success: false, error }`) instead of rejecting inside the map, so `Promise.all` won't fail fast and drop other ongoing I/O results.
