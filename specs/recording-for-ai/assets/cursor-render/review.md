# Native cursor and trail rendering checkpoint

The frame decoder gained one optional `overlay` parameter on the existing
`media.frame` route. There is no second decoder, renderer pipeline or
compatibility wrapper: `FrameSource` validates the overlay beside the crop,
`FrameImage` composites it before cropping and scaling, and `CursorOverlay` owns
the pixels. No pointer history, scene boundary or cutoff is chosen natively.

## Verification

Commands, run at this revision on macOS 26.6.2 arm64, Swift 6.3.3, Node 24.14.0:

- `swift run --package-path helpers/mac ScreenRecorderFrameTests` — 27 checks
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

## Visual review

`images/` holds the rendered set at the fixture's source resolution: the four modes
(`review-clean`, `review-pointer-only`, `review-circle-2s`, `review-circle-10s`)
from one identical source frame, a wave over the readable green text
(`review-wave-2s`), and the same circle through a button crop
(`review-circle-crop`) and a halved frame (`review-circle-scaled`). The generated
fixture gained a labelled `Send` button so a gesture has a readable control to
circle.

The implementer inspected the circle, wave, button crop and gap renders. The
magenta stroke reads over the dark background, the green text and the light button;
`Send` stays legible inside the circled area, and the circled button keeps 92% of
its pixels unchanged — the test bounds that below 35% coverage. Fading from the
oldest to the newest point is visible in every trail render, and the arrow's
asymmetry makes a mirrored render detectable.

The [integration review](integration-review.md) records root checks and the fresh
Opus critique. Small-output styling remains open; no real captured gesture has been
rendered.

## Settled choices

Styling was delegated to this fixture verdict:

- Magenta `1, 0.22, 0.70` stroke over a black halo at 60% of its opacity. Neither
  colour occurs in the fixture markers or the recorded surfaces, and the halo is
  what carries the thin stroke over a light control.
- Widths follow the source long edge — trail core 0.25%, minimum 2 px; halo 80%
  wider, minimum 2 px more; pointer height 1.2%, minimum 16 px — because drawing
  precedes the long-edge bound, so a fixed pixel width would vanish after downscale.
- Opacity falls linearly with age from 0.95 to 0.15 across `trailUs`, in twelve
  bands. Bands exist because stroking each 60 Hz segment separately beads the trail
  with darker round-cap overlaps.
- Ages are measured from the requested frame time, so the same parameters render
  the same pixels regardless of which sample the decoder selected.
- The pointer is an asymmetric arrow with its tip at the hot spot, white with a
  black outline, drawn opaque above the trail.
- Bounds: 1200 trail points per request (a 60 Hz sampler fills the ten-second
  contract cap with 600) and the ten-second cap itself, mirrored natively.
