# Synctax Roadmap

This directory contains detailed documentation for each phase of the Synctax v2.0 roadmap. Each phase is a self-contained document with architecture, API design, implementation details, and verification strategy.

## Phase Status

| Phase | Name | Status | Doc |
|-------|------|--------|-----|
| 0 | Bug Fixes | **DONE** | [phase-0-bug-fixes.md](phase-0-bug-fixes.md) |
| 1 | Refactor | **DONE** | [phase-1-refactor.md](phase-1-refactor.md) |
| 2 | Premium CLI Experience | Planned | [phase-2-premium-cli.md](phase-2-premium-cli.md) |
| 3 | Core Features | Planned | [phase-3-core-features.md](phase-3-core-features.md) |
| 4 | Env Vault & Profiles | Planned | [phase-4-env-vault.md](phase-4-env-vault.md) |
| 5 | Team & Sharing | Planned | [phase-5-team-sharing.md](phase-5-team-sharing.md) |
| 6 | Deferred / Future | Backlog | [phase-6-deferred.md](phase-6-deferred.md) |

## Principles

- **TDD always**: Failing test first, then implementation, then refactor.
- **Incremental delivery**: Each phase is independently shippable.
- **Backwards compat**: No consumer import changes unless absolutely necessary.
- **Tests green at every step**: Never proceed with a failing suite.
