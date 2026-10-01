# 21f2a — Durable deferred admission of captured sources

Status: implemented and verified at the source/SQL boundary. This is the acquisition-owned prerequisite of
[21f2](21f2-capture-coordination.md); fresh controller wiring remains planned.

## Contract and ownership

A settled capture with usable video can reserve one acquisition and its existing
import job in a single shared-catalog transaction, before opening source files.
The real CaptureStore supplies eligibility and recording/source identity from
that same connection; caller-fabricated lifecycle state is not admission authority.
Live, canceled and no-video outcomes cannot become successful empty acquisitions.

The existing acquisition row stores a capture intent bound to recording identity,
source identity and path. Internal request naming belongs to that owner and is
stable for the source. Changed authority conflicts instead of allocating another
acquisition. Existing explicit acquisition.import continues freezing its complete
file identities and optional absence before admission; its semantics do not relax.

Deferred execution first validates every persisted member identity and observed
absence, then freezes each newly observed member durably before moving on. A
later failure leaves the frozen prefix intact across retry and restart. An
unobserved required member that is temporarily missing can fail retryably;
changing a frozen member or adding a previously absent member refuses as changed
source. Temporary access failures retain their operational cause and remain
retryable; inability to read is not itself evidence of changed identity. The normalized journal must name the allocated source before any ready
evidence or assets publish.

JobQueue remains the durable pending/failed/canceled/ready authority. Repeating
admission returns the same job outcome; only existing explicit job.retry starts
another attempt. A caught notification is never success evidence. No second
request store, capture-admissions table, queue, lifecycle, public route, span or
automatic project is added.

## Verification boundary

Use real CaptureStore, AcquisitionStore, AcquisitionImporter and JobQueue over
scratch files, with scripted native export/probe responses. Pin queue-admission
rollback, authority conflicts and wrong-connection refusal, partial-freeze failure
and restart, failed/canceled replay, explicit retry, frozen identity/absence
refusal, source mismatch and stable ready replay. Assert no span/project creation.
These checks establish source/SQL/coordination contracts, not media parity, live
capture, physical synchronization or a completed-stop time.

## Evidence and next pickup

The focused capture/acquisition/explicit-import/queue cohort passed 98 tests. After
review corrected operational access-failure classification, the affected acquisition
suites passed 24 tests, including real source-directory and parent-directory
permission refusal/restoration. Core TypeScript checking/build and scoped lint pass. The new
[capture-admission tests](../../../packages/core/src/capture-acquisition.test.ts)
use the actual owners and queue with a scripted native boundary. Removing prior
identity validation made the frozen map grow after a changed journal; removing
the source-authority guard published the foreign source. Both negative controls
failed as intended, were restored, and the cohort passed afterward.

The immutable acquisition target and constant capture job input keep queue identity
independent of the growing observation map. Internal request identity derives from
the allocated source; replay cannot substitute a different directory. Acquisition
publication retains the existing importer/queue recovery contract: an already-ready
acquisition can answer an interrupted job's explicit retry without reopening donors.
No new table, column, route, lifecycle, model work or native build was introduced.

Next wire this seam into the existing capture coordinator in 21f2. That checkpoint
must exercise controller stop/replay/reopen, startup/close ordering and durable
admission status through the fresh service before public camera selection expands.
Root handoff and product-plan evidence remain maintained by the integrating agent.
