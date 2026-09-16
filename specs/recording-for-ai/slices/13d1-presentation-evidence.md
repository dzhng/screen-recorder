# 13d1 — Exact presentation evidence for movie inspection

Status: implemented; scoped native gates passed. Dependency: 13a. Parent: [13](13-edited-media.md).

## Contract

A movie displays the sample whose presentation support contains its time. The
nearest-frame inspector can instead select a future picture. Movie pointer
planning must consume the former without changing the public still selector.

`media.presentationEvidence` accepts the existing source/kept-span render plan
and a new absolute output path with a caller-supplied total byte budget. It streams a versioned JSONL header followed by
bounded clean RGB64 presentation records, then returns a small receipt only after
atomic publication. Each record identifies its retained span, exact rational
source interval and selected sample timestamp, or explicitly empty support.
Time values use decimal strings with a positive timescale so transport never
rounds fractional frame boundaries. Native owns presentation membership; future
consumers must compare exact times, never infer support from rounded timestamps.

The renderer and evidence producer share one sequential support traversal.
Unknown support fails; explicit empty edits retain the renderer's opaque black
meaning. No cursor policy, scene classification, pointer planner, movie overlay,
whole-recording JSON response or per-observation native process enters this pass.

## Verification

The native worker fixture must distinguish held from nearest future samples,
cover cuts and explicit empty edits, reject unknown support, preserve existing
render pixels/timing, and prove bounded records and cancellation cleanup. Output
publication refuses existing destinations and never owns their cleanup. An
interrupted attempt is not published evidence. The parent service owns cleanup
of attempt directories after process death, as for video rendering.

The [review and machine results](../assets/presentation-evidence/review.md) record
verification, limitations and the independent review resolution.

Next pickup: consume exact presentation intervals in a bounded core reader before
movie pointer planning. For a cut starting at 0.75 s, the held sample can have PTS 0; adapt the shared
policy input to support membership without changing nearest-still semantics.
Pointer policy/planning/overlay and parent 13 completion remain open.
