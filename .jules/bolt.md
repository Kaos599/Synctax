## 2025-04-13 - [Sequential I/O Blocking in Commands]
**Learning:** Operations like adapter reads (I/O over config files) in commands like  were executed in a sequential  loop which bottlenecks CLI performance as the app scales to more AI clients and larger files.
**Action:** When working on CLI commands involving multiple IO operations across configuration adapters, utilize `Promise.all` with an internal mapped try/catch correctly tracking individual outcomes in discriminated unions instead of sequential loops.
## 2025-04-13 - [Sequential I/O Blocking in Commands]
**Learning:** Operations like adapter reads (I/O over config files) in commands like `diff.ts` were executed in a sequential `for...of` loop which bottlenecks CLI performance as the app scales to more AI clients and larger files.
**Action:** When working on CLI commands involving multiple IO operations across configuration adapters, utilize `Promise.all` with an internal mapped try/catch correctly tracking individual outcomes in discriminated unions instead of sequential loops.
