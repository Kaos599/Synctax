# Bolt's Journal

## 2024-05-20 - Parallelize Independent Adapter I/O Operations
**Learning:** Sequential `for...of` loops iterating over active adapters perform poorly because `adapter.detect()` and `adapter.read()` involve file system I/O, leading to the total time being the sum of all operations. Refactoring loops to execute concurrently using `Promise.all` bounds execution time to the slowest adapter, dramatically improving CLI response times (like in `statusCommand` and `infoCommand`).
**Action:** When iterating over independent adapters or configurations that require async file reads/writes, map the array to an array of Promises and use `await Promise.all()` instead of sequential loops.