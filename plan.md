1. **Refactor `commandExistsOnPath` in `src/fs-utils.ts`**
   - Implement the fast `commandExistsOnPath` version utilizing `Promise.all` directly inside `src/fs-utils.ts`.
2. **Refactor existing `commandExistsOnPath` declarations to use the new fast one**
   - In `src/commands/validate.ts`, remove the local `commandExistsOnPath` function and import `commandExistsOnPath` from `../fs-utils.ts`.
   - In `src/commands/info.ts`, remove the local `commandExistsOnPath` function and import `commandExistsOnPath` from `../fs-utils.ts`.
3. **Refactor existing `isExecutableFile` declarations to use the new fast one**
   - In `src/fs-utils.ts`, implement `isExecutableFile` function.
   - In `src/commands/validate.ts`, remove local `isExecutableFile`.
4. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Call `pre_commit_instructions` tool.
   - Run tests.
5. **Submit the change**
   - Submit the PR with the title '⚡ Bolt: [performance improvement]' and description including What, Why, Impact, and Measurement.
