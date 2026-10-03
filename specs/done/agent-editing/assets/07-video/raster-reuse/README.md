# Bounded held-picture raster reuse

The production trigger is a compiled hold: 600 seconds at 20 fps emitted 12,000
identical Core Image compositions/rasterizations despite decoding one physical
source sample. This contributed repeated GPU work to a resource probe that exceeded
its unchanged 180-second observation cap. This is a bounded-work performance fix,
not a new editorial or persistent cache owner.

The old native and frozen-reference runs used the same source, frame count, canvas
and Rec.709/platform encoder settings. The 3-second runs both took about 2.06s;
30-second runs took 9.46s native and 8.38s reference. The old native 600-second arm
exceeded 180s; reference completed in 175.59s. See [measurements](before.json) and
own-process samples/observations alongside this document. These are sequential
observations on a contended host, not a controlled throughput benchmark. A timeout's
elapsed/requested-frame ratio is not completed throughput. No user processes were
stopped and no deadline was increased.

The renderer now retains at most one immutable output raster, keyed by reader
generation and selected physical sample time, with a distinct background key.
Source/stream changes, seeks and black/picture transitions invalidate it. Every
compiled frame still receives its original sample timestamp/duration and a separate
encoded sample. The existing four-buffer allocation threshold includes this retained
raster. All supported image-producing inputs are fixed per job; future animated
processing must extend the key or disable this reuse.

[Verification](verification.json) passes 15 decoded temporal cases, source profile
refusals, boundary refusals, 60- and 12,000-frame resource probes at the original
180-second cap, and cancellation/retry. Both holds rasterize exactly once, decode one
source sample and open one reader; decoded output frame counts remain 60 and 12,000.
Peak RSS was 36,667,392 and 35,192,832 bytes respectively. The transition case proves
A→black→A, same-time different assets and same-time different streams. Disabling
reuse produces 18 rasterizations instead of six ([mutation receipt](disabled-reuse-red.json)).
The restored worker passed the assertion. The rebuilt cancellation test separately
removed staging; same-path retry decoded exactly like the first held picture.

All 14 previously reviewed scenarios have [identical decoded pixels](pixel-preservation.json)
after this change; all eight matched-profile frozen reference comparisons remain
exact. The independent read-only Codex review found no concrete regressions in buffer
lifetimes, reuse identity, timing or tests. Its runtime boundary was explicit; the
implementer ran the live native gates.

Raster work is bounded by picture changes, but encoding and strict frame validation
still intentionally scale with output frame count. This does not establish a general
throughput SLA or broaden the photographic/HDR quality claim.

A separate normalized follow-up completed the 600-second held output in 114.52s
(0.00954 wall-seconds per output frame), retaining one raster and one decoded source
sample. Its 3s/30s observations were 3.10s/9.71s; this host variability prevents a
precise speedup claim. [Follow-up measurements](after.json) and its own-process sample
are retained. The sample no longer shows repeated Core Image rendering.

The final fresh Codex CLI visual reviewer received only neutral image paths and
visual criteria, with no source, spec, oracle or prior verdict. Its recorded image
tool events confirm inspection of all 30 full/counter sheets (15 scenarios).
It found readable counters, stable landmarks, no stretching, major clipping, tearing
or severe blur. Mild edge halos/blockiness persist, especially near B labels; this
is the already retained codec-quality limitation, not a temporal acceptance claim.
It observed every black/held/jumped interval without assuming intent. The new
transition's black cells 3–5 and A/B00 switches agree with the decoded oracle and
the implementer's direct full/crop inspection. VFR fixture colors remain brighter
than the regular source; those pixels are unchanged from the prior reviewed output.
Accept the scoped temporal/resource checkpoint, retaining broader quality limits.
