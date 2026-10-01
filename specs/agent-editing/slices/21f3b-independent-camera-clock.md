# 21f3b — Camera support without primary pictures

Status: actual absence probe is red: primary origin remains nil and offered camera
pictures become outside-support. This is the next native prerequisite after
[21f3a publication authority](21f3a-independent-publication.md), before
[21f3 atomic public integration](21f3-public-camera-selection.md).

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
