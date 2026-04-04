# Code Quality Baseline

This document defines the default code-quality expectations for this repository.

## Type Safety Expectations

- Prefer precise types and narrowing over escape hatches.
- Treat `unknown` as the default for untrusted input and narrow it before use.
- Avoid broad `as any` casts. If a cast is unavoidable, keep it narrow and local.
- Prefer runtime checks (`typeof`, `Array.isArray`, property guards) before access.

## Lint Expectations

- In staged rollout mode, fix lint errors first and reduce warnings opportunistically.
- In hard-gate mode, require zero lint warnings and zero lint errors.
- Use suppressions only when a rule cannot be satisfied without harming correctness, readability, or external integration behavior.
- When suppressing, scope it as tightly as possible and include a short reason.

## Suppression Rules

- Use inline suppressions (`eslint-disable-next-line`) instead of file-wide disables whenever possible.
- Always include a reason after `--`.
- Keep suppression targeted to one rule and one line.
- Record every approved exception in `docs/qa/2026-03-26-quality-baseline-checklist.md`.

Example:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party payload shape is runtime-defined
```

## Touched-File Hygiene

- If you touch a file, leave it at least as clean as you found it.
- Do not introduce new lint/type issues in touched files.
- Prefer small, behavior-preserving cleanups in touched areas when cheap and safe.
- Avoid unrelated refactors in the same change unless explicitly requested.
