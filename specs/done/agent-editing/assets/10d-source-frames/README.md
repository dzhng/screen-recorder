# Selected timed-video source pictures

Source and project frame inspection share one job/cache publication owner. Source
requests retain their actual asset and optional acquisition context; they never
invent a recording revision, clip, or canvas. The selected source's support digest
and renderer identity pin the recipe. Declared physical gaps and explicit capture
exclusions return distinct unavailability without scheduling a PNG.

Native source pictures use explicit-track `PresentationSource` membership, the
same color admission as compiled pictures, and the existing oriented `FrameImage`
PNG sink. The receipt carries requested source time, actual sample time, and exact
container-clock sample start/end with origin. `selection` receives an infinite
query end so the returned support endpoint is physical, not a clipped query bound.
No overlay or processing stack is implied by a raw source picture.

## Evidence

The native test creates two distinct video streams with a nonzero origin and a
physical empty edit. It checks exact sample start/end, acquisition exclusion,
bounded late selection, delivery dimensions, original hashes, and absence of files
for missing pictures. `native-requests.json` retains requests and receipts.
The prior binary refuses the new operation; a first-track mutation produces the
wrong second-track pixels. Cancellation through the real native wire leaves no PNG.

Core tests verify stream/context retention, source-only operation without project or
recording tables, physical versus capture gaps, malformed receipts, cache eviction,
and canceled late output followed by explicit retry. Removing receipt stream
validation makes its negative test fail. Existing project frame and preview tests
pass with the renamed shared owner. Native compiled-picture preservation passes
386 pictures across 18 cases after extracting shared color admission and PNG publication.

Both full native source PNGs are pixel-identical to independent AVAssetImageGenerator
references explicitly converted to sRGB, using the committed FrameColorReference
helper. Corner landmarks test horizontal and vertical placement. The bounded image
preserves the same composition. Full images, contact sheet, references, original
fixtures, profile receipts, and pixel metrics are retained under `visual/`.
Provenance records frozen binary/helper hashes and repeated-delivery image equality.
Fresh independent visual review found no visible pair differences, missing content,
or corruption; its limited judgment is recorded in `visual-review.md`.

This is native/core verification, not yet public source-frame CLI/MCP delivery.
It does not establish all codec/rotation/color combinations, rich imagery fidelity,
or a universal decoded-work bound. Actual counters describe returned decoded samples.
Raw still-image source inspection remains explicitly refused and open in 10d/06.
Scene, cut, interruption and retained screenshot-index generalization remain open;
no source index was synthesized from these demanded frames.

Independent code review found no actionable regressions and reran focused core
tests/types. Its native attempt was limited by its local toolchain/sandbox; the
separate frozen native gates above are the runtime evidence (`review.txt`).
