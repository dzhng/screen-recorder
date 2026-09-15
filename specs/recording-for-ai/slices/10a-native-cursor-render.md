# 10a — Native cursor and trail rendering on a requested frame

Status: generated-media native execution and delivered-pixel styling checks pass,
with independent visual critique and documented small-output limitations. Independent prerequisite:
native frame decoding (09a). This extracts 10's drawing seam so the pixels can be
verified against generated media while the core's scene-boundary analyzer and trail
selection proceed separately. It does not close 10.

## Contract

The existing `media.frame` route gains one optional `overlay` parameter. The core
supplies explicit video-pixel points and the requested frame time; native draws
exactly those points and nothing else. Selecting history, resolving a cutoff and
detecting scenes stay in the core: this library has no access to cursor evidence
and never reads a second sample.

An absent overlay leaves the frame clean. An overlay carries `trail` (runs of
points, ascending, each run continuously observed), `trailUs` (the requested trail
duration that ages those points) and an optional `pointer`. A gap between two runs
is a gap in the evidence; nothing is drawn across it. An overlay with no pointer
and no points is an honest statement that there was nothing to draw and renders
clean pixels while still reporting an overlay.

Points are oriented source-video pixels with a top-left origin, carrying their own
sample times. Drawing precedes the crop and the long-edge bound, so overlay and
crop coordinates are read in the same geometry. The result reports what was drawn:
point count, first and last trail times, and the pointer's own time.

Boundary, limit and invalid-input failures leave the original media untouched and
write no output: `INVALID_REQUEST` for malformed wire fields, `INVALID_RANGE` for
points off the source raster, non-finite coordinates, out-of-order points,
overlapping runs, an empty run, a trail without a duration, a duration over ten
seconds, or more than 1200 points. Rendering never relaxes the existing encoded
size limit.

## Verification

`swift run --package-path helpers/mac ScreenRecorderFrameTests` renders through the
real decoder: clean, pointer-only and trail modes from one source frame; first and
last path coordinates drawn; age fading measured between the newest and oldest
point; no path across a gap between runs; overlay coordinates preserved through a
crop and a halved frame; identical bytes on repeat. Marks are also measured in the
pixels the caller receives rather than the ones they were drawn in: a halved frame
keeps a coloured trail core inside its dark halo and a readable pointer, a 48-pixel
thumbnail is not covered by its own pointer, and a wave across the label leaves it
standing at both sizes. `node --test helpers/mac/Tests/frames.test.mjs` drives the
same modes through the worker process and pins the wire failures and unchanged
source bytes.

[Evidence and review](../assets/cursor-render/review.md) retains the rendered PNGs
and the settled styling choices.

## Open gates

Core scene analysis, trail-window selection, cutoff reporting and raw-history
retention remain open in [10](10-cursor-trails.md); this subpass is independent of
them. No real captured gesture has been rendered yet. The fresh small-output
critique and its dispositions are retained in the
[integration review](../assets/cursor-render/integration-review.md).
