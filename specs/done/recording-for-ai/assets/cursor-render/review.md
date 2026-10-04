# Native cursor and trail rendering checkpoint

The frame decoder gained one optional `overlay` parameter on the existing
`media.frame` route. There is no second decoder, renderer pipeline or
compatibility wrapper: `FrameSource` validates the overlay beside the crop,
`FrameImage` composites it before cropping and scaling, and `CursorOverlay` owns
the pixels. No pointer history, scene boundary or cutoff is chosen natively.

## Verification

Commands, run at this revision on macOS 26.6.2 arm64, Swift 6.3.3, Node 24.14.0:

- `swift run --package-path helpers/mac ScreenRecorderFrameTests` — 28 checks
  green, including the pre-existing decoding checks.
- `swift build --package-path helpers/mac` — green.
- `node --test helpers/mac/Tests/frames.test.mjs helpers/mac/Tests/wire.test.mjs` —
  4 tests green.

Behaviour pinned through real decoded frames: a clean request reports no overlay
and leaves the pixels untouched; a pointer-only request draws the glyph at its hot
spot and nothing on the far side of the gesture; a trail draws its first and last
supplied coordinates and fades measurably between them; two runs separated by a gap
are drawn without a path across it; a 140,190 crop and a halved long edge both keep
the marks on their source coordinates; repeating a request produces identical bytes.
Eighteen invalid requests — including every overlay bound, a source alias carrying a
valid overlay, and a malformed overlay through the worker — are refused with the
original media byte-identical afterwards.

Two red runs were observed before the code earned them: the pointer and trail
assertions failed on the un-drawn frame, and the worker test failed when the wire
dropped the overlay. The crop-order assertion was falsified once by moving the
composite after the crop; it failed for the expected reason and was restored.

The delivered-pixel sizing was earned the same way. Against source-pixel widths the
halved frame's cross-section assertion read zero core and zero halo rows, and the
halved pointer measured 6x8 delivered pixels against the 12-row minimum. Both were
re-run against the old sizing after the fact and failed again for those reasons.

## Visual review

`images/` holds every mode at three output sizes from one identical source frame:
the fixture's own 320x240, a 160-pixel bound, and a 48-pixel thumbnail. The modes
are `review-clean`, `review-pointer-only`, `review-circle-2s`, `review-circle-10s`,
a wave over the readable green text (`review-wave-2s`) and the same circle through a
button crop (`review-circle-crop`). The generated fixture gained a labelled `Send`
button so a gesture has a readable control to circle.
`images/before-delivered-sizing/` keeps the small renders as they were when widths
followed the source alone, from the same fixture bytes, so each pair differs only in
styling.

The implementer inspected the circle, wave, button crop and gap renders. The
magenta stroke reads over the dark background, the green text and the light button;
`Send` stays legible inside the circled area, and the circled button keeps 92% of
its pixels unchanged full size and 83% halved — the test bounds both below 35%
coverage. Fading from the oldest to the newest point is visible in every trail
render, and the arrow's asymmetry makes a mirrored render detectable.

### What the small output cost, measured

Widths used to be chosen in source pixels, so the long-edge bound thinned them
afterwards. Down the trail's cross-section in `overlay-scaled`, the whole mark — two
core pixels inside a two-pixel halo — arrived as two delivered rows of
`0.510, 0.188, 0.384`: half the magenta's red, and no dark outline left at all,
because the halo had been averaged into the core rather than drawn around it. The
same sizing left the pointer 6x8 delivered pixels, a smudge rather than an arrow.

Choosing those widths in delivered pixels instead puts the same cross-section at one
halo row, two core rows of `0.949, 0.329, 0.714`, and one halo row. The pointer
becomes 11x15. Nothing about the geometry moves: the reported point counts and times
are identical, and every frame delivered at source size is byte-identical to the
render this replaces. [delivered-sizing.json](delivered-sizing.json) records both,
through the real worker route and per render.

The premium is real and is paid by the content. Against the clean frame, the wave
covers 18% of the `frame 25` label's pixels full size and 31% halved, because a
delivered stroke cannot be thinner than a delivered pixel. The label stays readable
at both, and the test bounds both below 40%.

The [integration review](integration-review.md) records root checks and the fresh
Opus critique. No real captured gesture has been rendered.

## Settled choices

Styling was delegated to this fixture verdict:

- Magenta `1, 0.22, 0.70` stroke over a black halo at 60% of its opacity. Neither
  colour occurs in the fixture markers or the recorded surfaces, and the halo is
  what carries the thin stroke over a light control.
- Widths follow the source long edge — trail core 0.25%, halo 80% wider, pointer
  height 1.2% — so a mark stays proportional to the scene it was measured in.
- Their minimums are stated in delivered pixels instead, and divided back out by the
  scale the frame is about to be reduced by: core 2, halo 2 more, pointer 16. Drawing
  precedes the long-edge bound, so a minimum stated in source pixels is not the
  minimum the caller receives. These are the smallest widths at which a coloured core
  survives the downscale inside its own outline.
- The pointer minimum stops at a fifth of the delivered long edge. Below roughly a
  hundred delivered pixels a glyph large enough to read is a lid over the thing it
  points at, so the mark gives way to the content. Only the minimum is capped: a
  tight crop is a zoom, where the source-proportional size is already right.
- Opacity falls linearly with age from 0.95 to 0.15 across `trailUs`, in twelve
  bands. Bands exist because stroking each 60 Hz segment separately beads the trail
  with darker round-cap overlaps.
- Ages are measured from the requested frame time, so the same parameters render
  the same pixels regardless of which sample the decoder selected.
- The pointer is an asymmetric arrow with its tip at the hot spot, white with a
  black outline, drawn opaque above the trail.
- Bounds: 1200 trail points per request (a 60 Hz sampler fills the ten-second
  contract cap with 600) and the ten-second cap itself, mirrored natively.
