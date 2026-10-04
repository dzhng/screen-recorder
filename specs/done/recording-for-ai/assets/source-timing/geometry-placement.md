# Native geometry source placement

Date: 2026-09-16. Generated clock/geometry/journal fixtures; no screen or audio
capture and no synthetic input.

## Defect and ownership

Geometry first observed before source zero or during a pause was written with no
source time. An unchanged later frame did not create an observation, so an entire
epoch could remain unplaced even while its geometry projected real cursor samples.
The existing native cursor/geometry owner now emits the missing placement once;
its epoch, raw geometry and original observation remain unchanged. The capture
writer supplies source time from its existing clock, including usable-frame duration
checks at pause boundaries. An idle frame can still report a new geometry change,
but it cannot confirm an unchanged pending epoch. Source zero waits for an active
usable frame, including when pause happened before any video arrived.

## Evidence

The new regression first failed on the old change-only observation behavior:
“An unchanged first usable frame must place its prologue epoch at source zero.”
It now proves the raw and timed records coexist as epochs [1,1,2,3,3,4] at source
coordinates [nil,0,nil,nil,120,130]. Two paused changes remain distinct; only the
last receives a resumed placement. Repeated unchanged frames add no records.
Journal round-trip preserves their host timestamps and geometry epoch count.

A cursor batch is deliberately flushed after resumed observations while holding a
pre-pause reading. The returned cursor epochs remain [1,3] at source times [50,125],
so the change does not reinterpret late delivery as a later occurrence or alter
buffering. A separate clock fixture refuses source zero during a pre-origin pause
and starts at zero on the first active usable frame after resume. A second regression
failed when a delayed first frame from inside an already-completed pause established
origin; sharing the clock's host-range exclusion fixes this and also rejects a
first frame whose duration straddles that pause.

The capture executable passes its clock, cursor/geometry, journal and media-recovery
fixtures. Native debug build succeeds. All 14 source-evidence/recovery wire tests
pass, including source immutability, prefix integrity and bounded streaming.
These fixtures prove acquisition bookkeeping, not physical display/window behavior.
Independent Codex review found no actionable regression; its native target compiled
but execution could not allocate the video fixture inside its sandbox. The native
build and executable checks above ran outside that review sandbox.

## Compatibility and boundaries

No journal/event schema changes. Geometry record count can exceed distinct epoch
count because source placement is a second observation of an existing epoch.
Existing journals retain their missing placement; neither native export nor core
reads fabricate a mapping. The future trail owner still needs real placement,
pause and scene evidence and must not assume journal sequence is event time.

Delayed source zero can also make earlier completed pauses placeable. The native
[deferred pause owner](deferred-pauses.md) records those markers without rewriting
raw controls or discarding valid delayed media.
