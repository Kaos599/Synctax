## 2024-05-18 - Side effects in Dry Run prefetching
**Learning:** Hoisting configuration read/prefetch logic outside of existing conditional boundaries (like `!options.dryRun`) to batch operations can inadvertently introduce minor performance regressions by executing reads that would normally be entirely skipped in a dry run simulation.
**Action:** Always ensure that hoisted performance optimizations still tightly wrap and respect original execution conditionals, like checking for `--dryRun`, to avoid unintended side effects.
