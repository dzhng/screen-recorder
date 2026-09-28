# Source scene preparation

Asset scene preparation uses the existing SceneProcessing and JobQueue owners.
The selected asset, stream, acquisition support, source origin, sampler execution
identity and sampling policy identify immutable work. Admission retains the asset
and optional acquisition in the same transaction as the job. A changed execution
identity requests new work while prior published generations remain readable.

A shared bounded chunk loop publishes recording and asset evidence through their
respective codecs. Failed/canceled partial generations are removed; readiness
requires completed retained evidence plus queue publication. Ordinary reads do
not retry terminal work. Explicit cancellation can be retried; target-deletion
cancellation remains nonretryable under the existing queue policy. Deletion drains
the worker before its references can be released.

## Verification

Core preservation passes 533 tests with one existing skip. Core and service types
pass after rebuilding their package dependencies. The source preparation tests
cover real SQLite storage, atomic reference rollback, support masks, independent
streams, restart, partial failure, explicit retry, held-worker deletion and sampler
execution changes. Removing the sampler identity from the recipe fails the
identity-separation test; restored production passes. Independent review found no
actionable defects; see [review](review.txt). Existing recording/index processing tests still run unchanged
apart from the constructor shape.

A separate direct native experiment imports generated two-track media with a
nonzero origin and a physical gap, executes the real source-scene sampler through
two queued preparation jobs, and reads the retained chunks/boundary index. Both
streams become ready and retain the unavailable observation; original bytes remain
unchanged. [Receipt](native-result.json) includes the frozen native hash. This is
core/native preparation evidence, not a public CLI/MCP scene journey. No capture,
playback, app launch or user-library modification occurs.

The public service must construct the asset domain with its native sampler and
execution identity, dispatch asset `source-scenes` jobs to this owner, and connect
source preparation/status/retry to scene consumers. Source scene events and
retained screenshot selection remain open in slice 10d.
