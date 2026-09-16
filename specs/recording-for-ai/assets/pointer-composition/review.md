# Current pointer over held movie pictures

The [native renderer](../../../../helpers/mac/Sources/ScreenRecorderFrames/VideoRenderer.swift)
splits its existing held-picture intervals at the core's supplied pointer states.
Every split starts from clean pixels and reuses the frame overlay rasterizer with
an empty trail. Native does not infer pointing eligibility or interpolate input.

The attempt-owned schedule is streamed twice through one pinned file descriptor:
preflight validates its receipt and discovers the required clock, then consumption
checks the same bytes while retaining only the next state. Record buffers are
bounded, and publication occurs only after complete consumption and validation.
Matching metadata does not authenticate the source; the caller binds source,
revision, presentation evidence and schedule within one owned attempt.

## Exact timing

The video and AAC mux clocks must represent the supplied transitions exactly.
An unsupported clock fails before movie publication. Source clock discovery walks
retained sample metadata without decoding another video pass. It uses actual
transition denominators: a container can declare 16,384 ticks per second while all
its pictures begin on whole seconds. Requiring every unused container tick would
incorrectly reject an otherwise exact 44.1 kHz audio mux.

## Verification

Generated worker tests cover held-picture movement and explicit clearing, cuts,
sub-microsecond and one-third-second transitions, exact timing after AAC assembly,
empty support, changed schedule bytes, invalid initial states and unsupported clocks.
Existing movie/video gates preserve clean-frame pixels, color, duration and PCM
alignment. Native frame tests include cancellation after staging starts and prove
that a concurrently created destination survives while owned staging is removed.

The first independent code review caught a missing default executable in the test
runner. The normal local-build fallback now matches neighboring native tests. The
reviewer's native decoding was unavailable in its environment; actual runtime
results come from the worktree-owned build and test runs.

[Scale measurements](scale.json) increase the stream from 100 to 5,000 states:
peak memory rises from about 40.1 MB to 40.8 MB while the movie contains every state.
This establishes boundedness for this generated small-raster workload, not a
performance promise for arbitrary recordings.

The [independent image review](visual-review.json) records all 17 actual image-tool
inspections. Both visible positions differ from the clean baseline by 101 pixels
over a channel delta of 16; cleared states match the clean frame exactly. The
reviewer found no visible trails or residue. Enlarged crops show slight encoding
softness; the pointer is readable at delivered size. These gray generated frames
prove the composition seam, not usefulness over detailed real captures.

## Integration boundary

The native movie operation accepts the core schedule receipt. The caller must
prepare presentation evidence and the schedule inside the same owned movie attempt,
then pass the receipt with the original core plan. Clean rendering remains an
internal media primitive. Durable preview wiring, physical capture acceptance and
long realistic composition workloads remain parent-slice gates.

## Merged-tree checkpoint

The merged native pointer/movie tests pass (17 tests; [receipt](merged-tests.txt)).
Root inspected `moving-01.png`, `moving-02.png` and `moving-03.png`: a visible
current cursor changes position and clears without leaving the old glyph behind.
The same three frames were displayed in one Preview window for about five minutes
on 2026-09-16, starting around 22:38 UTC. No response arrived. Retain the current
appearance on this bounded generated evidence; physical gesture acquisition remains
unverified. The task's review window was closed afterward, preserving the unrelated
Preview window already present.
