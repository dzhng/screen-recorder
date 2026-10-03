# Actual CaptureWriter audio-gap reproduction

This is a causal reproduction, not a timing fix or physical capture acceptance.
It calls the production CaptureWriter callback, pause/resume, journal, finalization
and recovery owners with prerecorded buffers. No stream is started, no shareable
content is queried, no cursor sampler runs and no device/permission is activated.

Run `node packages/test-harness/editing/capture-audio-gap.mjs --out /tmp/empty-output`.
The harness builds the existing native capture-test executable and selects its
isolated probe mode. An inert SCStream object only supplies the callback argument,
as in existing CaptureWriter tests. Source video establishes zero and a bounded
2.5-second tail; interrupted finalization caps to that tail instead of inventing
wall-time padding. All tested audio ends precede that cap.

## Controlled comparison

All modes read the same hashed 48 kHz mono WAV through AVAssetReader's PCM output.
The retained input records include exact buffer frames, PTS, duration, channel count,
sample rate and format flags. Buffers are retimed into host time before entering
the actual writer. Its real format/settings and callback grouping apply; there is
no parallel TrackWriter or copied pause map in this probe.

The continuous control submits all 12 buffers and decodes exactly 96,000 samples
from 0.100 to 2.100 seconds. Omitting callback 4 removes 8,192 samples: the writer accepts
all 11 submitted buffers with no backpressure drops, but output ends at 1.929333
seconds although its declared last sample ends at 2.100 seconds. Decoded Float32 PCM
is byte-identical to the source with precisely that buffer removed and the remaining
samples concatenated. Thus the loss of source-time spacing is not an inference from
journal counts or a decoder-duration approximation.

The third mode invokes real pause/resume before delivering delayed prerecorded
samples. Their origin is derived from the observed journal host boundary, so the
existing clock decides which buffer spans the pause. It omits the same buffer 4;
its pause length is measured on each run, not asserted as exactly 20 ms. In the
retained final run the pause is 21.734 ms: declared end 2.078266 s, delivered end 1.929333 s,
a 148.933 ms early tail. The PCM bytes exactly match the known omission case.

Packet timestamps, raw decoded PCM, acquired support, source buffer identities,
production dropped/omitted counters and recovery results are retained in `run`.
There is no generic pass: the report says completed, but delivered timelines are
not preserved. The continuous control is aligned; both discontinuous cases are not.

## Cause supported by these observations

The actual production writer places retimed PCM buffers into one PCM MOV input.
For discontinuous admitted buffers, this recipe produces a contiguous payload
sequence rather than preserving the timestamp hole. A journal mask can remove
unacquired source intervals from reported support, but the later PCM samples have
already moved earlier. The current mask therefore cannot make later audio truthful.

This establishes production-owner applicability for these supplied PCM buffers,
not the prevalence or magnitude with real device callback sizes. The earlier
feature-owned reproduction was not enough to establish that; this one uses the
real owner with a continuous control and an exact sample-identity oracle. Actual
physical device timing and ten-minute drift remain unmeasured.

## General fix proposal — not implemented

Preserve sparse audio placement in the media representation using existing source
clock coordinates and container segment/edit-list semantics. Record exact accepted
PCM frame positions and source intervals for each contiguous run; then verify a
container that places those runs at their actual source times with explicit empty
gaps. The existing SourceSegment reader/recovery model already understands occupied
segments. Do not infer acquired silence, fit an offset, or relabel later packed
samples into a different source interval.

Crash handling must preserve the same truth before normal finalization. If the
container cannot durably express a gap while recording, retain explicit physical
PCM-run-to-source mappings before claiming recovery support, and verify their
sample identity against the recovered file. That is an owner-level design question
to resolve experimentally before changing behavior, not permission to add another
timeline or silently repair the journal. A small isolated AVAssetWriter/container
experiment should establish the supported representation first.

Required follow-up controls: continuous input unchanged; missing middle buffer and
pause-overlap omissions preserve later marker positions; multiple gaps and nonzero
start; crash/restart before and after a run boundary; actual recovered sample values
match the claimed intervals. No silence padding or hidden offset was added here.

## Scope, review and preservation

Only pause()/resume() visibility changes in production: internal to package, matching
CaptureWriter's existing package-scoped callback/seal/finish seams. Parameters and
behavior are unchanged. This avoids a test-only clock injection or debug-only import.
The default capture test executable still runs the existing suite when probe
variables are absent. The isolated request supplies both output and corpus paths.

The shared production journal and MediaRecovery are consumed directly. Raw evidence
is compressed without changing its byte contents. This probe's simulated screen and
interrupted terminal status are explicit; it is not a real recorded tutorial, a
healthy-stop test, or an accepted camera/screen/microphone synchronization gate.


The default native capture suite still passes all 42 existing checks. Independent
read-only review found no actionable issue within this causal scope; its quoted
pause numbers refer to `reviewed-initial-report.json`. The final run naturally has
a slightly different observed wall-time pause, retained in `run/report.json`; the
continuous and omitted-buffer controls and exact PCM identities are unchanged.
The temporary inspect-existing-output option was removed before retention so a
fresh run always pins the binary that actually produced its data.
