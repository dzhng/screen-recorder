# Scene evidence ownership

The scene store owns one canonical chunk validator and one generation lifetime for
recording and asset sources. Catalog keys include owner kind as well as owner ID,
so an asset and a recording cannot collide even when their IDs, source IDs,
attempts and policies match. The selected stream, optional explicit acquisition,
available-support digest and source duration are pinned before the first chunk
and cannot change during that generation. Duration has one persisted authority.
Asset admission validates against the existing selected-source owner; no recording
or revision is synthesized.

Recording processing and portable metadata retain their actual recording-domain
shape. Domain conversion happens at that boundary, while the store and bounded
reader use neutral identities. Asset evidence cannot be exported as a recording
package. The canonical chunk validator, comparison deduplication, portable codec
payload and sampling policy are unchanged. Queue publication still establishes
readiness; completing retained rows does not create a published job artifact.

The owner tables change shape, so fresh writable catalogs use format 8. Format 7
is explicitly refused rather than migrated. Tests use isolated temporary homes;
no existing library is opened or altered by this checkpoint.

## Verification

`core-tests.log` records 474 passing core tests, one existing skip, using two
workers with the existing test timeouts. An initial default-worker run hit eight
5-second timeouts in storage-heavy cases; no assertion tolerance or timeout was
changed. Core TypeScript compilation and focused lint checks pass.

The new ownership tests use real catalog, asset and acquisition stores. They
cover cross-domain ID collisions, wrong source/stream/support/duration/context,
immutable descriptors across appends, unchanged raw chunks, explicit rejection
of an asset through the recording-package boundary, and cancellation/resumption
across bounded reclamation batches. Existing scene, recording processing,
selection, event paging, screenshot-index and portable relocation tests pass.
Removing the descriptor consistency check made both stream and acquisition
rebinding tests fail; `descriptor-mutation.log` retains that result. Restoring it
passed the ownership suite and broader core checks.

Independent review found one negative portable test still passing the recording
identity directly to the neutral reader. Converting that fixture restored the
intended wrong-source check. The core test type-check and nine focused portable/owner
tests pass after the fix; no further actionable core defects were reported.
The reviewer's broader test run encountered localhost-listen sandbox refusals,
separate from the unrestricted two-worker run retained here.

## Boundary and next work

This is a core store prerequisite, not asset scene preparation or screenshot-index
acceptance. Service constructor/domain-boundary wiring is integrated by the parent
pass. Asset job admission, sampling and retention through shared job/resource
owners remain next, including gap-aware observations and scene policy identity.
The existing chunks cannot yet represent an unavailable sample grid.

Source/project scene-event seeks need indexes over actual boundary timestamps;
chunk request times alone are insufficient for the preserved nearest-sample
recording policy. Source screenshot selection must separate source coordinates
from actual recording revisions before retained index ownership is generalized.
Project cut and capture-interruption contracts remain open. This checkpoint does
not change those categories from unsupported to ready or empty.
