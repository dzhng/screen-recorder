# Export abandonment verification

Host checks passed 45 native/service cases and 322 core/deletion tests. Native,
core and service builds passed. The fixtures use generated silent media and private
temporary output directories, not user recordings or destinations.

The new cases exercise failed destination collision cleanup while preserving source
bytes and unrelated output; late external commit while abandonment and recording
deletion share one drain; an actual SIGKILL after native private retirement but before
metadata acknowledgement; unsafe staging substitution followed by explicit retry;
and late commit followed by retirement failure. That last case keeps cleanup capacity
charged while releasing evidence that can no longer be needed for regeneration.
Existing capacity coverage now proves abandonment frees a slot without deleting the
recording. UUID reuse after completed abandonment creates a new job, and abandoning
a committed result leaves the external file intact.

A core lifetime test retries a canceled job while its older worker remains alive.
Single-job retirement cannot finish or forget that identity until the older worker
settles. Removing the drain await makes its pending-lifetime assertion fail; restoring
it passes. The same test verifies a ready artifact disappears together with the job,
so later identity replay cannot inherit its old result.

Independent Codex review found no actionable regressions and passed all 44 queue
tests plus TypeScript builds. Its sandbox native tests failed during fixture preview
readiness, before abandonment ran; the host native receipt supplies that evidence.

- [Native/service result](export-abandonment-native.txt)
- [Core/deletion result](export-abandonment-core.txt)
- [Drain negative control](export-abandonment-drain-red.txt)
- [Drain restored](export-abandonment-drain-green.txt)

These checks cover process interruption, not power loss. Public service wiring,
queued recovery, staging storage totals and long-video budgets remain later gates.

[Root combined verification](../owner-integration/README.md) covers the merged package, export and storage owners.
