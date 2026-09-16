# Shared clean visual observations

Status: native observations and bounded core comparison are integrated. Real UI
policy acceptance and persisted global evidence remain open. This is a prerequisite for local trail resets and global screenshot
selection, not a second scene detector.

The native FrameSource/FrameImage owners return bounded low-resolution clean
RGB observations using their existing retained-span selection, orientation and
nearest-tie rules. Internal media.visualSamples accepts one source/kept interval
and at most 52 ordered timestamps spanning at most 10.2 seconds. It returns
requested/actual source time, distance, source/raster dimensions and sRGB RGB8
bytes at a maximum 64-pixel edge. No overlay, crop, scene threshold, edit mapping
or derivative PNG belongs in this operation.

Core owns the source-anchored 5 Hz grid and one deterministic comparison policy
used by both local trail analysis and global indexing. Compare actual-PTS pairs;
repeated actual PTS are held evidence, not transitions. Store measured changed
pixel fraction and channel difference with policy identity, keeping sampling
coverage explicit. A sub-200ms state can be missed; this is not semantic scene
recognition or exhaustive capture analysis.

Resolve overlay timing before shipping defaults: a held earlier video sample must
not erase cursor motion during the requested static interval, while a nearest
future frame must not receive an older trail across a visible change. The native
observation seam reports evidence only and must not choose that core policy.
Generate sparse held/change fixtures to settle this alongside the existing
requested/actual frame contract. Pause, cut and geometry boundaries remain
independent reset evidence.

Local requests need a predecessor observation for their first comparison, clipped
at the kept span, without extending the rendered trail. Global chunks retain that
predecessor across chunk edges. Decode/coverage failures remain explicit.


[Native evidence](../assets/visual-observations/native-review.md) covers the encoded
orientation oracle and bounded observation execution. [Core evidence](../assets/scene-analysis/core-review.md)
covers synthetic policy metrics and held-frame handling. The [public trail evidence](../assets/public-trails/review.md) now verifies
requested-time planning and delivered defaults on generated page fixtures.
Persisted shared observations and real UI policy acceptance remain separate work.

[Trail timing](10c-trail-timing.md) records the encoded sparse held/future
selection evidence and the implemented bounded compatibility policy.
