# Bounded core visual change analysis

The core comparison owner is [scenes.ts](../../../../packages/core/src/scenes.ts).
It receives native clean RGB observations and emits measured pair differences;
no decoder, timing mapper, renderer or scene decision exists beside that owner.
`analyzeSceneRange` uses the injected native sampler for a bounded source range.
`analyzeVisualSamples` accepts the previous chunk's final observation so a future
whole-recording job can run the identical policy across chunk boundaries.

## Evidence and limits

All 92 core tests pass, including ten scene tests. Core build and type-check pass.
Independent `codex review --uncommitted` found no actionable defects and independently
ran those checks successfully. The [measured fixture ledger](synthetic-metrics.json)
records the policy and exact metrics. A 52-observation/51-comparison synthetic batch
took 9.75 ms in one local run; that excludes native decoding and is not a latency
promise.

The fixtures are generated 64×64 RGB arrays, not actual screen recordings, encoded
video or labeled UI captures. They establish deterministic policy behavior and
bounded work, not the slice's real circle/scroll/resize acceptance gate. Native
observation integration, persistence, global jobs, geometry lookup, public trails
and the requested-versus-actual overlay anchor remain unfinished.

The synthetic sparse scroll changes 15.625% of pixels across every spatial cell;
text reflow changes 8.594% across 75% of cells. Both reset. A compact highlight
changes 3.125% across 9.375% of cells, and a caret changes 0.195% across 3.125%;
neither resets. An initial 10% active-cell gate missed the reflow fixture; lowering
that gate to 5% retains its spread without admitting the local fixtures. The policy
constants remain centralized in code and must be revisited against decoded UI
fixtures rather than treated as universal thresholds.

## Review and decisions for integration

**Sound, medium confidence — combine amount and spread.** On a white web page,
scrolling may change only thin lines of text. Requiring almost half the image to
change misses that movement. The policy accepts either a large changed area or a
smaller changed area spread across many cells. It ignores the fixture's compact
button/caret changes. This can still miss very sparse changes and classify broad
animation or brightness changes as boundaries. It does not recognize navigation,
text meaning or gestures. Threshold discretion was delegated; real fixture
acceptance remains open.

**Sound, high confidence — include explicit endpoint observations.** The source
anchored 5 Hz grid receives one preceding observation and the requested endpoint
when absent from the grid. A non-grid final request therefore compares the pixels
actually relevant to that request instead of stopping early. The context step may
precede the requested range but never its retained span. A retained span's exclusive
end samples at end minus one microsecond. At most 52 observations cover at most
10.2 seconds. Observation coverage is sampled coverage, not proof that every brief
intermediate state was seen.

**Sound, high confidence — preserve actual timestamps and distances.** Repeated
selection of one held frame produces no new comparison, but each requested time
and distance remains in coverage. Changed pixels are placed at the later actual
frame timestamp, never the grid timestamp. A future selected frame outside the
requested interval may produce a comparison but cannot claim a reset inside it.
A subsequent whole-recording chunk can reuse the final full observation; passing
that predecessor yields the same pair metrics as one uninterrupted batch.

**Sound, high confidence — failures do not imply clean scenes.** Invalid, partial,
reordered, changed-held-frame or out-of-kept-span observations fail. Native errors
and cancellation propagate. Raster dimensions must match within a pair; geometry
changes need their separate producer and are not silently labeled scene changes.

Integrated verification: all ten scene tests pass alongside the 101-test core
suite. Native visual observation wire tests pass on the shared tree: a 52-sample
batch returned 484,915 bytes in 983.6 ms with 29,507,584 bytes peak RSS. Existing
frame wire tests pass. These measurements still use generated media.


The integrated encoded timing test passes through the native sampler and shared
core analyzer. Three frames at 0/2/4 seconds retain held coverage through the earlier
tie at 1 second; requesting 1.5 selects actual 2 seconds and exposes a future
comparison without falsely reporting a past boundary. Substituting the requested
sampling-grid timestamp for the comparison's actual timestamp makes this test fail;
restoring actual timing passes. This proves the timing seam, not UI thresholds or
cursor rendering. [Next policy pass](../../slices/10c-trail-timing.md).

Timing-pass review found no actionable defects in the test or docs. Independent
Codex runtime checks encountered native decode failures alongside existing tests
inside its sandbox; the integrating host's real native run passed. Shape review
keeps this as a consumer test of existing owners, with no second scene policy.

## Requested-time frame compatibility

The shared core now obtains local trail-window observations and, for a future
decoded sample, one past-only reference through the existing native sampler.
Neither sampling nor returned trail range advances beyond the request. The
reference comparison stays separate from past scene boundaries, so a future change
is available to veto an overlay without being backdated into the requested range.

All 111 core tests pass, including 16 scene tests. Three native/core encoded tests
pass. The long-gap fixtures have samples at 0/120/240 seconds and request second
119: matching pixels report no detected endpoint change, replaced pixels report
a change at actual second 120, and both resolve the past reference at 0. The
two-second local grid uses at most twelve observations and one separate reference,
not a grid over the two-minute gap. Source bytes stay unchanged.

Removing the past-only search constraint from the built core makes both long-gap
checks fail; restoring it passes. Core build/types and lint pass. Independent
Codex review found no actionable regressions and passed the focused core checks;
its native checks failed alongside the existing fixture in its sandbox. The
integrating host's native tests above passed outside that sandbox.

Shape review retains the same comparison, image selector, decoder and validator.
The additional result is compatibility evidence, not a rendered cursor or a public
default. Geometry/pause selection, cursor runs, persistence and real UI threshold
acceptance remain separate work.
