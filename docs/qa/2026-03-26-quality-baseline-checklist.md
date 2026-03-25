# 2026-03-26 Quality Baseline Checklist

Status: In progress (staged rollout active)

## Verification Command Order

Run commands in this order and record each outcome:

1. `bun run typecheck`
2. `bun run lint`
3. `bun run lint:strict`
4. `bun run test`
5. `bun run check`
6. `bun run check:strict`

Execution rule: run the full matrix and record outcomes even if strict commands fail.

## Transition Interpretation

- Staged mode: `lint` may pass with warnings.
- Hard-gate mode: `lint:strict` and `check:strict` must pass with zero warnings.

## Suppression Policy

- Inline, targeted suppressions only.
- Every suppression must include a short reason.
- File-wide disables are exceptions and must be explicitly approved.

## Hard-Gate Promotion Criteria

Promote to hard gate only when all criteria are met:

- `bun run typecheck` passes.
- `bun run lint` passes with zero warnings.
- `bun run lint:strict` passes.
- `bun run test` passes.
- `bun run check:strict` passes.
- Suppression register has no unapproved exceptions.

## Strict-Readiness Result

Status: Not ready to promote hard gate yet.

- `bun run typecheck`: Pass.
- `bun run lint`: Pass with warnings (0 errors, 240 warnings).
- `bun run lint:strict`: Fail (`--max-warnings=0`, 0 errors, 240 warnings).
- `bun run test`: Pass (377 tests).
- `bun run check`: Pass (`typecheck` pass, `lint` pass with warnings, `test` pass).
- `bun run check:strict`: Fail (non-zero from `lint:strict` warnings).
- Recommendation: Continue staged rollout while burning down warnings.

## Suppression Register

Use this table for every approved suppression exception.

`Follow-up` format: `Approved by <name> on <YYYY-MM-DD>; record: <PR/comment/doc link or path>`.

| File | Rule | Reason | Owner | Follow-up |
|------|------|--------|-------|-----------|
