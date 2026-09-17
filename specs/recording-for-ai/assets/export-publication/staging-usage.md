# Private export storage observation

`Publication.usage` measures the logical lengths of the publication owner's private
files through an identity-checked directory descriptor. It takes no exclusive lock,
so incomplete preparation remains measurable while a writer is alive. It never
opens the published destination or follows payload links. This is a live observation,
not a transactionally consistent snapshot or a physical disk-block estimate. Known
receipt hard links each contribute their file length, matching existing logical
storage accounting. Unknown files are outside this owner's written file set.

The shared native owner names the disposable files for both measurement and cleanup.
Observation never cleans them. Missing leaves contribute zero; a replaced staging
directory, linked payload or unexpected file type fails rather than reporting bytes
from another object. A missing directory remains an error for the caller to reconcile
through the existing intent/cleanup authority.

## Evidence

The first test failed on the absent method. After implementation, the host build
passed all eight tasks and all 18 publication native/service tests passed, including
three added consumer tests. They cover partial file growth with the publisher lock
held, replaced directories, linked payload rejection, prepared receipt lengths,
external commit and acknowledgement, and a sparse file above 32-bit length. The
export remains readable after private bytes return to zero.

- [Host test receipt](staging-usage-tests.txt)
- [Initial failing consumer](staging-usage-red.txt)

Service type checks and touched-file lint passed. Independent Codex review found no
actionable defect; its native test attempt was blocked by sandbox/toolchain cache
access, so the host run above supplies native verification. Shape review kept this
inside Publication and its existing native boundary: no second scanner, table,
queue or cleanup owner.

## Integration still required

This internal primitive does not change public `storage.usage`. The export owner
must enumerate its own durable intents, retain operation lifetime across measurement,
join/cancel observations during shutdown, distinguish confirmed cleanup from a missing
or substituted destination, and add private staging lengths to recording/global totals.
Do not include the user-owned exported movie. Package reservations are a separate
quantity from observed file lengths. Public export wiring remains gated on that
accounting, source retention, queued recovery and explicit abandonment.
