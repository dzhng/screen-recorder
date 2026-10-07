# Caller cutover review

## Full uncommitted pass

No discrete, actionable correctness issues were found in the staged, unstaged, or untracked changes.
## Final focused follow-up

Clean verdict: no actionable correctness issues found.

- `apps/cli/src/wait.ts:170-179` safely removes preparation-only fields before the strict getter call and preserves generation pinning.
- `packages/test-harness/editing/evidence.mjs:431-435` prepares the exact acquisition-bound source before captured project transcript reads.

Proof status: the focused Vitest test was blocked by an environment `EPERM` creating its temp directory; the native evidence journey was not run.
The root agent ran the focused CLI wait tests successfully outside the reviewer's read-only sandbox. The acquisition-bound evidence caller was inspected but its
complete native evidence journey was not rerun; the controlled speech-parity
journey is the separately scoped retained public proof.
