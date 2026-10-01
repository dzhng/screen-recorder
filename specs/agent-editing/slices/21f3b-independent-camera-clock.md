# 21f3b — Camera support without primary pictures

Status: native prerequisite and shared-interruption correction are merged-verified.
[21f3a publication authority](21f3a-independent-publication.md) remains its base;
[21f3 atomic public integration](21f3-public-camera-selection.md) is the next
consumer. The [merged checkpoint](../assets/21f3b-shared-interruption/merged-verification.json)
links the corrected source and complete default capture gate. The original absence
failure remains retained as evidence; camera-only admission is now a required
default capture-test gate.

## Contract and owner

A requested camera can produce independently usable media when primary video has
no picture. Use the first accepted usable camera picture's actual converted host
PTS for its fixed source origin when primary origin is absent. Never invent that
origin from arrival time, the start request or a placeholder primary sample.
Commit the origin only after successful append. A later primary picture cannot
move that origin or rewrite accepted camera PTS.

Reuse CaptureClock's actual host pause intervals and admission rules through an
origin-relative projection; no second pause controller, lifecycle or sample
buffer. Preserve primary origin, microphone/system PCM placement, cursor and
elapsed-time policy exactly. Camera closure, journal, result, proof and publication
receipt carry its own origin/support/projection, not a still-nil primary clock.
Recovery consumes actual durable pause-start/end host facts, including controls
before primary origin exists. The empty primary-relative pauses array cannot
stand in for those facts.

When primary origin is established before camera admission, preserve the existing
camera behavior. Independently accepted camera pictures before the first primary
picture are an intentional new support case. Preserve their fixed camera origin
when primary later starts; document this difference rather than altering the
primary winner. Source placement derives from actual host origins and projected
pauses; it is not necessarily their raw origin difference when a pause lies
between them. The caller still authors every project and layout explicitly.

## Numerical and production gate

Use the following deterministic CaptureClock/CameraWriter arithmetic oracle:
no primary callbacks, completed host pause
[1,100,000, 1,300,000) microseconds, and a delayed valid camera picture at 1,000,000
with 50,000 duration establish camera origin 1,000,000 and PTS 0. Pictures at 1,400,000
and 1,500,000 map to 200,000 and 300,000. Its pause projection has boundary 100,000
and elapsed pause 200,000. Primary origin/duration remain absent/no-video.
Paused or boundary-spanning samples stay rejected, including delayed delivery
after resume. Later primary first picture at 1,600,000 changes only primary origin;
all already accepted camera mappings remain unchanged.

Also drive the actual NativeCapture/ClockIngress/CameraWriter path through its
existing prerecorded input boundary. Native pause/resume use actual host time:
read the retained control host timestamps and derive matched expected mappings
from those facts, rather than injecting the literal oracle times into lifecycle
controls. Verify cross-source correspondence, decoded picture order/digests, exact
source support, binding, closure, retry and recovery.

Include a fractional first-host-PTS control: rounding origin upward must not lose
the first picture. Name and prove the conversion/support rule for this new origin
using exact native timestamps; preserve existing primary and established-origin
camera rounding. This is a mechanical timing decision requiring evidence, not a
new alignment heuristic. Retain the original absence probe's failure and remove
its opt-in diagnostic disposition once this actual requirement passes.

Keep accepted primary clock/PCM and normal camera preservation gates meaningful.
No audio buffering or new mic-origin policy is implied. No hardware, model work,
audible playback, windows, installed switch or frozen-worker replacement. Offline
current-source capture-test builds reuse existing code dependencies. This proves
controlled source support; physical synchronization and stop deadlines stay open.
Review shape, code, documentation and choices; retain source/runtime identities
and explicit permitted differences before commit.

## Implementation and retained decisions

[CaptureClock](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureClock.swift)
remains the sole pause controller. A camera reads its raw host intervals through
its fixed source origin; no extra lifecycle, pause controller or buffering was
added. [CameraWriter](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraWriter.swift)
commits its origin only after an accepted append and journals raw control times,
including controls that precede that origin. Its closed source carries that
projection into publication and recovery. Native closure passes shared input
interruption to both sources while keeping a primary-only completion error, such
as no primary pictures, out of a healthy camera's diagnostic.

For a new independent origin only, conversion rounds down to a whole microsecond.
The exact rational picture timestamp remains relative to that origin. Thus a
first host timestamp of 1,000,000.75 microseconds has origin 1,000,000 and relative
PTS 0.75 microseconds; canonical media quantization yields first support at one
microsecond. Nearest rounding would put that first exact picture before zero and
reject it. Established-primary and primary rounding remain unchanged. This
choice and the fixture ordering control are disclosed in the
[choices ledger](../choices.md#21f3b--independent-camera-origin).

The preservation fixture explicitly establishes primary before camera admission.
It offers the same prologue callback after the first accepted delayed camera
picture, where it is rejected as reordered; it does not silently drop that
callback. The original camera-first ordering is a separate positive control that
retains the newly supported prologue picture. Existing positive camera support
and five-picture assertions remain in their established-primary gate.

## Verification evidence

The implementation and arithmetic gates live in
[IndependentCameraClockTests](../../../helpers/mac/Tests/ScreenRecorderCaptureTests/IndependentCameraClockTests.swift)
and the default camera-only requirement in
[IndependentPublicationTests](../../../helpers/mac/Tests/ScreenRecorderCaptureTests/IndependentPublicationTests.swift).
The literal no-primary/later-primary pair retains identical camera picture
hashes and support. Actual NativeCapture controls derive expected placement from
retained host pause times. Recovery checks immutable journal bytes, source
binding, support and picture verification. A pre-origin completed pause is
retained as raw controls without subtracting camera time; open-pause and delayed
paused callbacks are rejected.

All work uses `/tmp/screenrec-capture-facts`, based on `da1466f21bd19404053b51307194f21eaed9eaf6`.
The [durable packet](../assets/21f3b-independent-camera-clock/README.md) retains
the original manifest, source freeze, complete cohorts, failure artifacts and
source/runtime identities; its member manifest verifies every archived byte.
The original working manifest remains `/tmp/screenrec-21f3b-evidence.json`. Current-source offline builds use
`/tmp/screenrec-21f3b-build`; the 21f3a source, runtime and cohorts stay frozen.
No installed worker, model, hardware capture, window or playback was used.

The original actual no-primary failure is retained at
`/tmp/screenrec-21f3b-final-origin-red.log`. Isolated source mutations establish
that the new gates fail for the intended reasons:
`/tmp/screenrec-21f3b-rebase-red.log` rejects a later-primary rebase, and
`/tmp/screenrec-21f3b-rounding-red.log` rejects nearest-rounding an independent
fractional origin. Those mutation executions exited 133; production source was
never mutated for those experiments.

A cross-run comparison of the readable frozen 21f3a and first 21f3b publication
receipts preserves all twelve timing/support results. Eleven also have the same
picture digest. One independently encoded audio-retry-observations case differs
in decoded pixels and encoded byte size; an isolated same-source rerun reproduces
the frozen digest. Each run's raw-to-canonical picture proof passes. This is not
a claim of deterministic pixels across separate encodes; its precise cause is
unestablished. The intentionally corrupted receipt remains explicitly excluded.
The comparison, pixel difference measurements and isolated control are retained
with the evidence manifest.

Shape, code and documentation review retained one clock owner and no compatibility
layer. The initial root production review requested the pre-origin pause boundary,
now covered. A later independent review found that a shared interruption arriving
during primary encoder closure could be lost from camera diagnostics because its
value had been captured before the await. The correction reads the current shared
interruption inside companion closure; primary-only completion failures remain
local. The deterministic regression replaces the primary journal after paused
input drain, observes the real finish-time JOURNAL_FAILED interruption before
camera closure, and verifies that camera publication and recovery retain it. The configured CLI review was not retried:
the known provider/model HTTP 400 remains the user's prohibition on that path.
Primary clock/PCM, cursor and elapsed behavior continue through the default
capture suite. These tiny prerecorded gates make no physical synchronization,
large-take throughput or stop-deadline claim.

Final current-source build: `/tmp/screenrec-21f3b-build-complete.log`, exit 0.
The six final executions all exit 0: `final-clock`, `final-origin`,
`final-independent`, `final-publication`, `final-selected-input`, and `final-full`
under the `/tmp/screenrec-21f3b-` prefix. The first five retain their output
folders plus matching `.log`; the full default suite retains its log. The default
suite covers the unchanged primary clock/PCM, cursor and elapsed contracts once.
The extra pre-origin-control mutation also fails at the raw-host-control oracle,
with `/tmp/screenrec-21f3b-preorigin-red.log` retained. Merged-tree gates remain
the integrating agent's responsibility.


The [shared-interruption correction packet](../assets/21f3b-shared-interruption/README.md)
retains the failing original-source runner identity, corrected source/runtime identities,
complete red/green/control artifacts and full-suite log. Its actual red exits 133
at the lost-camera-diagnostic assertion; corrected regression, camera-only
NO_VIDEO control and full default suite each exit 0. The original 21f3b packet and
runtime are unchanged. This correction preserves an already-delivered shared
interruption; it introduces no new error ownership or finalization lifecycle.
