# Queued recovery and publication budget evidence

Fresh core/service/native builds precede the host result: 57 native/service cases
passed, alongside 330 core/deletion/worker/deadline checks. Touched-file types, lint
and formatting passed. Generated silent recordings and temporary destinations are
the only media used.

An actual killed-owner fixture leaves an uncertain external commit. Recovery remains
queued behind a transient package worker, then restores the committed receipt even
when source processing has failed. Repeated status/admission does not create another
attempt. A backlog exceeding one admission pass first fills the shared runnable budget,
then existing capacity events admit its remaining work; all expected movies survive
and private staging files clear.

A failed recovery does not starve its sibling or automatically retry. Explicit retry
can observe a now-missing destination without publishing anything. Canceling a recovery
holds the lane until its publication lifetime closes, and a commit it actually observed
still survives the discarded job result. Abandonment drains/removes recovery jobs only
inside the selected export's validated identity boundary, leaving a neighboring intent
and both external files intact.

After acknowledged cleanup, moving the destination directory causes no native calls
from historical status/retry. Private abandonment still refuses the unavailable parent
until it is restored and its retained identity can be verified.

The actual deadline test runs preparation through a delayed native executable whose
worker default is deliberately too short. The publication-specific known-byte allowance
lets it finish with bytes identical to the pinned preview. Removing that override makes
the export fail; restoring it passes. The pure budget check also covers size growth,
invalid byte values and the existing worker maximum.

Independent Codex review found that explicit recovery reused a completed negative
observation. An actual move-away → missing → restore-same-inode case reproduced the
failure. Explicit recovery now regenerates that observation job, while automatic
admission still leaves it alone; the regression and final host run pass. The review's
type/new-unit checks passed, but its native tests failed during sandbox fixture setup,
so they are not counted as native verification.

- [Native/service result](queued-recovery-native.txt)
- [Core and neighboring result](queued-recovery-core.txt)
- [Deadline negative control](queued-recovery-budget-red.txt)
- [Deadline restored](queued-recovery-budget-green.txt)
- [Observation refresh before correction](queued-recovery-refresh-red.txt)
- [Observation refresh after correction](queued-recovery-refresh-green.txt)

This proves process interruption and queue lifetimes, not power-loss durability,
physical pointer/narration acceptance or a public export route. Service composition
and complete processed-package writing remain separate work.
