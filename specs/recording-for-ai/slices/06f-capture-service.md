# 06f — Machine capture control through the service

Status: complete for machine capture control, allocation and source reconciliation.
The packaged app's own fixture window is captured through the real service, client and
socket; 11 app capture checks, 16 service capture checks and the existing lifetime,
library-operation and native recovery checks pass together. Dependencies: 01, 02, 06c,
06d, 06e. This does not close parent [06](06-service-and-jobs.md): durable artifact
jobs, `recordings.list`, storage accounting and delete remain there.

## Contract

`capture.sources`, `start`, `status`, `pause`, `resume`, `stop`, `cancel` and `restart`
are declared in the protocol's one operation registry and bound by the same service
dispatcher as every library operation. No capture capability exists outside it.

The service allocates a take's recording ID, capture-source ID and source directory
before native starts, persists what the capture session reports, and settles takes whose
capture it can prove ended. Native owns the device, its permissions, its media and its
own generation guards; it stamps the allocated source ID into its journal and reports
transitions. Neither side keeps a second device state machine or a second catalog.

- **Two owners, one order of events.** The app's private pipe now carries calls in both
  directions: the app calls service operations, and the service calls the app's capture
  session. Each direction correlates by request ID, refuses more than the shared
  in-flight bound and settles every waiting call on a deadline, a malformed frame or the
  channel ending.
- **One sequence line, two producers.** Journal record numbers are the lifecycle
  sequences native reports, and they stay below `NATIVE_SEQUENCE_LIMIT`. Events the
  service authors itself — a refused start, a cancel, a reconciled interruption — are
  numbered from that limit up, so a service-authored outcome is always the later word and
  a late native report cannot silently occupy or overwrite its number.
- **Replay, not a second take.** A start request ID is the catalog's allocation key, and
  allocating against it is a durable receipt: the catalog states whether a request is
  being allocated for the first time or replayed, and stores the canonical arguments it
  was allocated for. A repeated request answers with the same take and never starts
  capture twice; the same ID asking for a different source or a different audio selection
  is `REQUEST_CONFLICT`, not a second interpretation. The receipt outlives the service, so
  a replay after a relaunch still names that one take. A restart allocates a distinct new
  take and answers a replay with that same new take. A start native refuses leaves an
  interrupted take with the refusal's reason, no original revision and no media, and so
  does a take whose preparation refused before native was ever asked — a receipt that
  could never resolve is worse than a settled failure.
- **A replay never re-asks the device.** Replaying a take whose start was never proved
  ends and settles that take instead of starting it again: a second start would be refused
  because the first one may still be running, and that refusal says nothing about the media
  the first start may already have written. A replay that still cannot prove the take
  ended answers `UNRESOLVED_START`, retryable, with the take left unsettled — still
  reachable by a later stop, by the session's own reports and by the next startup's
  recovery.
- **Only a live take transitions.** Pause and resume on a take that has already ended are
  refused with `INVALID_STATE` rather than answered with its stored outcome. Stopping a
  finished take stays idempotent, and pausing a paused take or resuming a recording one
  stays idempotent through native's own validation, which is the only thing that knows
  what the device is doing.
- **One owner for the audio default.** The protocol's capture selection is the single place
  either audio default is stated: these takes are narrated, so the microphone is on unless
  a caller refuses it, and system audio stays out until it is asked for. Every start sends
  both choices explicitly, and native refuses a start that omits either rather than keeping
  a default of its own to disagree with.
- **A deadline is not a refusal.** Only native's own answer says what the device did, so a
  start the channel never carried an answer for is ended on the device and settled from the
  media that ending left behind. A take whose end cannot be proved stays unsettled, still
  reachable by a later stop, by the session's own reports and by the next startup's
  recovery. The app owns a start that is still in flight: service loss and a normal quit
  each finalize the take it lands on rather than leaving it capturing unindexed.
- **Ends that stay honest.** If the service disappears mid-capture, native finalizes the
  take into its own journal and nothing restarts the service. A normal quit finalizes and
  stores the outcome before terminating. Anything left live in the catalog is settled at
  the next startup from that take's own journal and media through the existing native
  `media.recover`, never from an assumption: a recovery that cannot run leaves the take
  alone for the next startup rather than publishing an unproved state. That recovery takes
  the capture order ahead of every mutation the announced listener accepts, so a take
  cannot be restarted on the device underneath its own recovery. A validated prefix
  registers an ordinary original revision; no decodable video is terminal with no `r0`.
- **Cancel is explicit.** It stops that take's work, discards it, removes only its own
  allocated directory and drops it from discovery. A completion still in flight lands
  under the service-authored cancel as a no-op.

## Verification

`apps/macos/tests/capture-service.test.mjs` drives the packaged app, its service child
and the local client against a temporary `SCREENREC_HOME`. Every take it starts states
`microphone: false` and `systemAudio: false`, and the app refuses a fixture take that asks
for either — including one that merely defaults to the microphone — so no check can reach
an audio device. It covers: fixture-only source listing, a take discoverable before it is
ready, pause/resume/stop leaving an inspectable `r0`, pause and resume refused once that
take is complete, paused time absent from the source duration, the allocated source ID in
the journal, replayed and concurrent starts, a refused source, cancel and restart, a killed
service followed by relaunch reconciliation, a take killed before any decodable media, a
normal quit during capture, a service lost or a normal quit while a take is still starting,
and a start whose answer is lost being replayed onto its own take rather than onto a second
one.

Anything that acts on a start still in flight synchronizes on a fixture-only hold: the app
announces that it is holding an accepted start, waits for a named file to appear, and ends
the hold on its own deadline whether or not a check releases it. Only a launch that already
opened this app's own fixture window and was given that path can hold at all, so an ordinary
launch has no such mechanism. Every app and every process it owns is signalled and waited
for before the scratch directory holding its media is removed, and a process this run owns
that outlives it fails the run.

`apps/service/src/capture.test.ts` drives the real service with the test acting as the
app, so native refusals, pushed reports, recovery outcomes, an unanswered native call, an
unanswered start, a start whose start and cleanup stop were both unanswered and then
replayed, a request ID reused for a different take, pause and resume on a settled take, the
audio default reaching native, and a start replayed onto a take that is still being
recovered are exact and bounded. Screen permission is never requested automatically: a missing permission
fails the capture checks with an actionable message instead of substituting a mock.

Not proved here: microphone or system audio capture, display and region sources, menu
recording controls, artifact jobs, and sudden power loss. A catalog written before takes
carried their allocation arguments still opens, but a start request ID recorded by that
older build can no longer be replayed — there is nothing stored to prove the replay asks
for the same take, so it answers `REQUEST_CONFLICT`. That take is still readable, still
stoppable and still reconciled at the next startup.
